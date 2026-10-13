from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from core.models import BusinessProfile, Customer, Partner, Product, Service, SerialNumber, StockMovement, Invoice, InvoiceItem, Payment
from core.services.stock_service import StockService
from core.services.tax_engine import TaxEngine, amount_to_words_indian



class InvoiceService:
    """
    Transactional Business Service for Invoice Creation, Stock OUT, and Multi-Mode Payments.
    """

    @staticmethod
    @transaction.atomic
    def create_and_post_invoice(user, payload):
        """
        Creates and posts a new POS invoice atomically:
        1. Validates physical product stock.
        2. Computes line-item and GST tax totals.
        3. Saves Invoice & InvoiceItems.
        4. Triggers Stock OUT for PRODUCT lines (skips SERVICE lines).
        5. Records multi-mode split payments & updates payment_status.
        6. Increments BusinessProfile next_invoice_number.
        """
        items_raw = payload.get('items', [])
        if not items_raw:
            raise ValidationError("Invoice must contain at least one item line.")

        # 1. Fetch Seller & Buyer Details
        seller_profile, _ = BusinessProfile.objects.select_for_update().get_or_create(id=1)
        
        customer_id = payload.get('customer_id')
        customer_obj = None
        if customer_id:
            customer_obj = Customer.objects.filter(id=customer_id).first()
            if not customer_obj:
                raise ValidationError(f"Customer with ID {customer_id} does not exist.")
            if not customer_obj.is_active:
                raise ValidationError(f"Customer '{customer_obj.name}' is inactive and cannot be billed.")

        buyer_name = payload.get('buyer_name') or (customer_obj.name if customer_obj else 'Cash Customer')
        buyer_gstin = payload.get('buyer_gstin') or (customer_obj.gstin if customer_obj else '')
        buyer_state_code = payload.get('buyer_state_code') or (customer_obj.state_code if customer_obj else seller_profile.state_code)
        buyer_address = payload.get('buyer_address') or (customer_obj.billing_address_line1 if customer_obj else '')

        # 2. Pre-validate all PRODUCT and SERVICE items
        serials_seen = set()
        for item in items_raw:
            item_type = item.get('item_type', 'PRODUCT')
            if item_type == 'PRODUCT':
                prod_id = item.get('product_id')
                if not prod_id:
                    raise ValidationError("Product line item must specify a valid product_id.")
                product_obj = Product.objects.filter(id=prod_id).first()
                if not product_obj:
                    raise ValidationError(f"Product with ID {prod_id} does not exist.")
                if not product_obj.is_active:
                    raise ValidationError(f"Product '{product_obj.name}' is inactive and cannot be sold.")

                qty = item.get('quantity') if item.get('quantity') is not None else item.get('qty', 1)
                serial_num = (item.get('serial_number') or '').strip()
                if serial_num:
                    if serial_num in serials_seen:
                        raise ValidationError(f"Duplicate serial number '{serial_num}' specified in invoice.")
                    serials_seen.add(serial_num)

                StockService.validate_stock(product_obj, qty, serial_num)
            elif item_type == 'SERVICE':
                svc_id = item.get('service_id')
                if not svc_id:
                    raise ValidationError("Service line item must specify a valid service_id.")
                service_obj = Service.objects.filter(id=svc_id).first()
                if not service_obj:
                    raise ValidationError(f"Service with ID {svc_id} does not exist.")
                if not service_obj.is_active:
                    raise ValidationError(f"Service '{service_obj.service_name}' is inactive and cannot be billed.")

        # Determine whether this is a GST Tax Invoice or a Non-GST / Estimate Bill
        is_gst_flag = payload.get('is_gst')
        inv_type = payload.get('invoice_type')
        
        # Populate default gst_rate from product or service master if omitted in payload
        for item in items_raw:
            if 'gst_rate' not in item or item['gst_rate'] is None:
                if item.get('item_type') == 'PRODUCT' and item.get('product_id'):
                    p = Product.objects.filter(id=item['product_id']).first()
                    if p:
                        item['gst_rate'] = float(p.gst_rate)
                elif item.get('item_type') == 'SERVICE' and item.get('service_id'):
                    s = Service.objects.filter(id=item['service_id']).first()
                    if s:
                        item['gst_rate'] = float(s.gst_rate)

        # Check if all items are 0% GST and customer has no GSTIN
        all_zero_tax = all(float(item.get('gst_rate', 0) or 0) == 0 for item in items_raw)

        if is_gst_flag is False or inv_type == 'NON_GST' or (all_zero_tax and not buyer_gstin and is_gst_flag is not True):
            is_gst_flag = False
            invoice_type = 'NON_GST'
            # For Non-GST, zero out GST so no tax is added or calculated
            for item in items_raw:
                item['gst_rate'] = 0.0
        elif all_zero_tax and not buyer_gstin:
            is_gst_flag = False
            invoice_type = 'NON_GST'
            for item in items_raw:
                item['gst_rate'] = 0.0
        else:
            is_gst_flag = True
            invoice_type = 'TAX_INVOICE'

        # 3. Calculate GST and Totals via TaxEngine
        tax_results = TaxEngine.calculate_invoice_taxes(
            items_data=items_raw,
            seller_state_code=seller_profile.state_code,
            buyer_state_code=buyer_state_code
        )

        # Validate that upfront non-credit payments do not exceed invoice grand total
        non_credit_paid = sum(
            Decimal(str(p.get('amount', 0))) for p in payload.get('payments', [])
            if str(p.get('payment_mode', 'CASH')).upper() != 'CREDIT'
        )
        if non_credit_paid > tax_results['grand_total'] + Decimal('0.01'):
            raise ValidationError(
                f"Total upfront payment (₹{non_credit_paid}) cannot exceed invoice grand total (₹{tax_results['grand_total']})."
            )

        # 4. Generate Invoice Number based on continuous serial sequence
        if is_gst_flag:
            next_num = seller_profile.next_invoice_number
            invoice_num = f"{seller_profile.invoice_prefix}{next_num}"
            while Invoice.objects.filter(invoice_number=invoice_num).exists():
                next_num += 1
                invoice_num = f"{seller_profile.invoice_prefix}{next_num}"
            seller_profile.next_invoice_number = next_num + 1
        else:
            non_gst_prefix = getattr(seller_profile, 'non_gst_prefix', 'EST-') or 'EST-'
            next_non_gst = getattr(seller_profile, 'next_non_gst_number', 1001) or 1001
            invoice_num = f"{non_gst_prefix}{next_non_gst}"
            while Invoice.objects.filter(invoice_number=invoice_num).exists():
                next_non_gst += 1
                invoice_num = f"{non_gst_prefix}{next_non_gst}"
            seller_profile.next_non_gst_number = next_non_gst + 1

        # 5. Create Invoice Record
        invoice = Invoice.objects.create(
            invoice_number=invoice_num,
            invoice_date=payload.get('invoice_date', timezone.now().date()),
            customer=customer_obj,
            invoice_type=invoice_type,
            is_gst=is_gst_flag,
            seller_name=seller_profile.company_name,
            seller_gstin=seller_profile.gstin,
            seller_state_code=seller_profile.state_code,
            buyer_name=buyer_name,
            buyer_gstin=buyer_gstin,
            buyer_state_code=buyer_state_code,
            buyer_address=buyer_address,
            delivery_note=payload.get('delivery_note', ''),
            mode_of_payment=payload.get('mode_of_payment', 'Cash'),
            reference_no=payload.get('reference_no', ''),
            buyer_order_no=payload.get('buyer_order_no', ''),
            dispatch_doc_no=payload.get('dispatch_doc_no', ''),
            dispatched_through=payload.get('dispatched_through', ''),
            destination=payload.get('destination', ''),
            terms_of_delivery=payload.get('terms_of_delivery', seller_profile.terms_of_delivery),
            subtotal=tax_results['subtotal'],
            discount_amount=Decimal('0.00'),
            taxable_amount=tax_results['taxable_amount'],
            total_cgst=tax_results['total_cgst'],
            total_sgst=tax_results['total_sgst'],
            total_igst=tax_results['total_igst'],
            total_tax=tax_results['total_tax'],
            grand_total=tax_results['grand_total'],
            balance_due_amount=tax_results['grand_total'],
            payment_status='UNPAID',
            invoice_status='POSTED',
            amount_in_words=tax_results['amount_in_words'],
            tax_amount_in_words=tax_results['tax_amount_in_words'],
            partner_allocation_json=payload.get('partner_allocation_json'),
            created_by=user
        )

        # 6. Save InvoiceItems & Trigger Stock OUT for PRODUCT lines
        for item_calc in tax_results['items']:
            item_type = item_calc.get('item_type', 'PRODUCT')
            product_obj = Product.objects.filter(id=item_calc.get('product_id')).first() if item_calc.get('product_id') else None
            service_obj = Service.objects.filter(id=item_calc.get('service_id')).first() if item_calc.get('service_id') else None
            
            serial_obj = None
            if item_calc.get('serial_number') and product_obj:
                serial_obj = SerialNumber.objects.filter(product=product_obj, serial_number=item_calc['serial_number']).first()

            desc = item_calc.get('description') or (product_obj.name if product_obj else (service_obj.service_name if service_obj else 'Item'))
            hsn_sac = item_calc.get('hsn_sac') or (product_obj.hsn_sac if product_obj else (service_obj.sac if service_obj else '852411'))
            unit = item_calc.get('unit') or (product_obj.unit if product_obj else 'NOS')

            item_cost = StockService.get_product_unit_cost(product_obj, serial_number_str=item_calc.get('serial_number')) if (item_type == 'PRODUCT' and product_obj) else Decimal('0.00')

            InvoiceItem.objects.create(
                invoice=invoice,
                item_type=item_type,
                product=product_obj,
                service=service_obj,
                serial_number=serial_obj,
                description=desc,
                hsn_sac=hsn_sac,
                quantity=item_calc['qty'],
                unit=unit,
                rate=item_calc['rate'],
                discount_pct=item_calc['discount_pct'],
                unit_cost=item_cost,
                taxable_value=item_calc['taxable_value'],
                gst_rate=item_calc['gst_rate'],
                cgst_rate=item_calc['cgst_rate'],
                cgst_amount=item_calc['cgst_amount'],
                sgst_rate=item_calc['sgst_rate'],
                sgst_amount=item_calc['sgst_amount'],
                igst_rate=item_calc['igst_rate'],
                igst_amount=item_calc['igst_amount'],
                total_amount=item_calc['total_amount']
            )

            # Trigger Stock OUT ONLY for physical products (skips services)
            if item_type == 'PRODUCT' and product_obj:
                StockService.process_stock_out(
                    product=product_obj,
                    quantity=int(item_calc['qty']),
                    movement_type='SALE',
                    reference_type='INVOICE',
                    reference_id=invoice.invoice_number,
                    serial_number_str=item_calc.get('serial_number'),
                    unit_cost=item_cost,
                    unit_price=item_calc['rate'],
                    notes=f"Customer Sale Invoice #{invoice.invoice_number}",
                    user=user,
                    movement_date=invoice.invoice_date
                )

        # 7. Record Multi-Mode Split Payments (Excludes CREDIT entries!)
        payments_data = payload.get('payments', [])
        payment_counter = 1
        for p_data in payments_data:
            p_amount = Decimal(str(p_data.get('amount', 0)))
            p_mode = str(p_data.get('payment_mode', 'CASH')).upper()
            
            # Do NOT create payment records for CREDIT and do NOT add CREDIT to total_paid!
            if p_amount > 0 and p_mode != 'CREDIT':
                p_number = f"PAY-{invoice.invoice_number}-{payment_counter}"

                # Determine payment-specific partner allocation
                p_partner_alloc = p_data.get('partner_allocation_json')
                p_payer = p_data.get('payer') or p_data.get('partner_id')
                
                if not p_partner_alloc and p_payer and str(p_payer).upper() != 'BUSINESS':
                    try:
                        p_partner_obj = Partner.objects.get(id=int(p_payer))
                        p_partner_alloc = {
                            'partner_id': p_partner_obj.id,
                            'partner_name': p_partner_obj.name,
                            'amount': float(p_amount),
                            'mode': p_mode
                        }
                    except (Partner.DoesNotExist, ValueError):
                        p_partner_alloc = None
                elif p_partner_alloc and isinstance(p_partner_alloc, dict):
                    # Ensure accurate amount and mode for this specific payment record
                    p_partner_alloc = dict(p_partner_alloc)
                    p_partner_alloc['amount'] = float(p_amount)
                    p_partner_alloc['mode'] = p_mode
                elif not p_partner_alloc and str(p_payer).upper() == 'BUSINESS':
                    # Explicitly business store till
                    p_partner_alloc = None
                elif not p_partner_alloc and not p_payer and len(payments_data) == 1 and payload.get('partner_allocation_json'):
                    # Fallback for single payment payload with top-level partner_allocation_json
                    top_alloc = payload.get('partner_allocation_json')
                    if isinstance(top_alloc, dict):
                        p_partner_alloc = dict(top_alloc)
                        p_partner_alloc['amount'] = float(p_amount)
                        p_partner_alloc['mode'] = p_mode

                Payment.objects.create(
                    payment_number=p_number,
                    invoice=invoice,
                    customer=customer_obj,
                    payment_date=invoice.invoice_date,
                    payment_mode=p_mode,
                    amount=p_amount,
                    reference_number=p_data.get('reference_number', ''),
                    partner_allocation_json=p_partner_alloc,
                    notes=f"Payment for Invoice #{invoice.invoice_number}",
                    created_by=user
                )
                payment_counter += 1

        # Consolidate partner allocation summary on the Invoice header
        partner_payments = invoice.payments.filter(partner_allocation_json__isnull=False)
        if partner_payments.exists():
            distinct_partners = set()
            total_partner_amt = Decimal('0.00')
            last_partner_info = None
            for pp in partner_payments:
                alloc = pp.partner_allocation_json
                if alloc and isinstance(alloc, dict):
                    p_id = alloc.get('partner_id')
                    distinct_partners.add(p_id)
                    total_partner_amt += pp.amount
                    last_partner_info = alloc
            
            if len(distinct_partners) == 1 and last_partner_info:
                invoice.partner_allocation_json = {
                    'partner_id': last_partner_info.get('partner_id'),
                    'partner_name': last_partner_info.get('partner_name'),
                    'amount': float(total_partner_amt),
                    'mode': 'SPLIT' if partner_payments.count() > 1 else last_partner_info.get('mode', 'CASH')
                }
            elif len(distinct_partners) > 1:
                invoice.partner_allocation_json = {
                    'partner_id': None,
                    'partner_name': 'Split Across Partners',
                    'amount': float(total_partner_amt),
                    'mode': 'SPLIT'
                }
        else:
            invoice.partner_allocation_json = None

        # 8. Update Invoice Payment Status via Single Source of Truth
        invoice.recalculate_payment_status()
        invoice.save()

        # 9. Save Business Profile with updated invoice counter
        seller_profile.save()

        return invoice

    @staticmethod
    @transaction.atomic
    def record_delayed_payment(user, invoice_id, payment_payload):
        """
        Records delayed customer payment(s) against a partially paid / unpaid invoice.
        Supports single payment object or list of split payments.
        """
        invoice = Invoice.objects.select_for_update().get(id=invoice_id)
        if invoice.invoice_status == 'CANCELLED':
            raise ValidationError("Cannot record payment for a cancelled invoice.")

        payments_list = payment_payload.get('payments')
        if not payments_list:
            payments_list = [payment_payload]

        valid_payments = []
        total_amount = Decimal('0.00')

        for p_item in payments_list:
            p_mode = str(p_item.get('payment_mode', 'CASH')).upper()
            if p_mode == 'CREDIT':
                continue

            amt = Decimal(str(p_item.get('amount', 0)))
            if amt <= 0:
                continue

            partner_alloc = p_item.get('partner_allocation_json')
            partner_id = p_item.get('partner_id') or p_item.get('payer')
            if partner_id and str(partner_id) != 'BUSINESS':
                try:
                    partner_obj = Partner.objects.get(id=int(partner_id))
                    partner_alloc = {
                        'partner_id': partner_obj.id,
                        'partner_name': partner_obj.name,
                        'amount': float(amt),
                        'mode': p_mode
                    }
                except (Partner.DoesNotExist, ValueError):
                    pass

            valid_payments.append({
                'amount': amt,
                'payment_mode': p_mode,
                'reference_number': p_item.get('reference_number', ''),
                'partner_allocation_json': partner_alloc,
                'notes': p_item.get('notes') or payment_payload.get('notes', f"Payment for Invoice #{invoice.invoice_number}")
            })
            total_amount += amt

        if total_amount <= 0:
            raise ValidationError("Total payment amount must be greater than zero.")

        if total_amount > invoice.balance_due_amount + Decimal('0.01'):
            raise ValidationError(
                f"Payment amount ₹{total_amount} exceeds remaining balance due ₹{invoice.balance_due_amount}."
            )

        pay_count = invoice.payments.count()
        recorded_payments = []
        p_date = payment_payload.get('payment_date') or timezone.now().date()

        for p_data in valid_payments:
            pay_count += 1
            payment_num = f"PAY-{invoice.invoice_number}-{pay_count}"
            while Payment.objects.filter(payment_number=payment_num).exists():
                pay_count += 1
                payment_num = f"PAY-{invoice.invoice_number}-{pay_count}"

            payment = Payment.objects.create(
                payment_number=payment_num,
                invoice=invoice,
                customer=invoice.customer,
                payment_date=p_date,
                payment_mode=p_data['payment_mode'],
                amount=p_data['amount'],
                reference_number=p_data['reference_number'],
                partner_allocation_json=p_data['partner_allocation_json'],
                notes=p_data['notes'],
                created_by=user
            )
            recorded_payments.append(payment)

        # Consolidate partner allocation summary on the Invoice header
        partner_payments = invoice.payments.filter(partner_allocation_json__isnull=False)
        if partner_payments.exists():
            distinct_partners = set()
            total_partner_amt = Decimal('0.00')
            last_partner_info = None
            for pp in partner_payments:
                alloc = pp.partner_allocation_json
                if alloc and isinstance(alloc, dict):
                    p_id = alloc.get('partner_id')
                    distinct_partners.add(p_id)
                    total_partner_amt += pp.amount
                    last_partner_info = alloc
            
            if len(distinct_partners) == 1 and last_partner_info:
                invoice.partner_allocation_json = {
                    'partner_id': last_partner_info.get('partner_id'),
                    'partner_name': last_partner_info.get('partner_name'),
                    'amount': float(total_partner_amt),
                    'mode': 'SPLIT' if partner_payments.count() > 1 else last_partner_info.get('mode', 'CASH')
                }
            elif len(distinct_partners) > 1:
                invoice.partner_allocation_json = {
                    'partner_id': None,
                    'partner_name': 'Split Across Partners',
                    'amount': float(total_partner_amt),
                    'mode': 'SPLIT'
                }
        else:
            invoice.partner_allocation_json = None

        invoice.recalculate_payment_status()
        invoice.save()

        return recorded_payments[0] if len(recorded_payments) == 1 else recorded_payments

    @staticmethod
    @transaction.atomic
    def process_sales_return(user, invoice_id, return_payload):
        """
        Processes a customer sales return atomically:
        1. Validates invoice and items returned.
        2. Validates return quantities do not exceed original sold quantity minus previous returns.
        3. For physical products:
           - Quantity tracking: triggers Stock IN via StockMovement(SALES_RETURN).
           - Serial tracking: validates serial status is SOLD, updates status to RETURNED, triggers Stock IN.
        4. Adjusts invoice balances.
        """
        invoice = Invoice.objects.select_for_update().get(id=invoice_id)
        if invoice.invoice_status == 'CANCELLED':
            raise ValidationError("Cannot process sales return for a cancelled invoice.")

        items_to_return = return_payload.get('items', [])
        if not items_to_return:
            raise ValidationError("Sales return request must specify at least one item to return.")

        returned_movements = []
        serials_processed = set()
        total_refund_value = Decimal('0.00')

        for item_data in items_to_return:
            item_id = item_data.get('invoice_item_id')
            invoice_item = invoice.items.filter(id=item_id).first() if item_id else None

            if not invoice_item:
                p_id = item_data.get('product_id')
                if p_id:
                    invoice_item = invoice.items.filter(product_id=p_id).first()

            if not invoice_item:
                raise ValidationError(f"Specified item (ID: {item_id}) does not belong to Invoice #{invoice.invoice_number}.")

            try:
                ret_qty = int(item_data.get('quantity', 1))
            except (TypeError, ValueError):
                raise ValidationError(f"Return quantity for '{invoice_item.description}' must be a valid positive integer.")

            if ret_qty <= 0:
                raise ValidationError("Return quantity must be greater than zero.")

            # Calculate total previously returned quantity for this line item
            prev_movements = StockMovement.objects.filter(
                reference_type='SALES_RETURN',
                reference_id=invoice.invoice_number
            )
            if invoice_item.product:
                prev_movements = prev_movements.filter(product=invoice_item.product)
            
            previously_returned_qty = prev_movements.aggregate(total=Sum('quantity'))['total'] or 0

            if (previously_returned_qty + ret_qty) > int(invoice_item.quantity):
                raise ValidationError(
                    f"Cannot return {ret_qty} units of '{invoice_item.description}'. "
                    f"Sold: {int(invoice_item.quantity)}, Already Returned: {previously_returned_qty}."
                )

            line_unit_rate = invoice_item.rate
            line_gst = (line_unit_rate * invoice_item.gst_rate) / Decimal('100')
            line_unit_total = line_unit_rate + line_gst
            total_refund_value += (Decimal(str(ret_qty)) * line_unit_total)

            # Process inventory and serial updates for physical products
            if invoice_item.item_type == 'PRODUCT' and invoice_item.product:
                product_obj = invoice_item.product

                if product_obj.tracking_type == 'SERIAL_NUMBER':
                    serial_str = (item_data.get('serial_number') or (invoice_item.serial_number.serial_number if invoice_item.serial_number else '')).strip()
                    if not serial_str:
                        raise ValidationError(f"Serial number is required for returning product '{product_obj.name}'.")

                    if serial_str in serials_processed:
                        raise ValidationError(f"Duplicate serial number '{serial_str}' submitted in return request.")
                    serials_processed.add(serial_str)

                    serial_obj = SerialNumber.objects.select_for_update().filter(
                        product=product_obj, 
                        serial_number=serial_str
                    ).first()

                    if not serial_obj:
                        raise ValidationError(f"Serial number '{serial_str}' does not exist for product '{product_obj.name}'.")

                    if serial_obj.status != 'SOLD':
                        raise ValidationError(
                            f"Serial number '{serial_str}' cannot be returned because its status is '{serial_obj.status}' (must be 'SOLD')."
                        )

                    unit_return_cost = invoice_item.unit_cost if getattr(invoice_item, 'unit_cost', Decimal('0.00')) > Decimal('0.00') else product_obj.purchase_price
                    return_date_val = return_payload.get('return_date') or invoice.invoice_date
                    movements = StockService.process_stock_in(
                        product=product_obj,
                        quantity=1,
                        movement_type='SALES_RETURN',
                        reference_type='SALES_RETURN',
                        reference_id=invoice.invoice_number,
                        serial_numbers_list=[serial_str],
                        unit_cost=unit_return_cost,
                        unit_price=line_unit_rate,
                        notes=item_data.get('reason', f"Customer Sales Return for Invoice #{invoice.invoice_number}"),
                        user=user,
                        movement_date=return_date_val
                    )
                    if movements:
                        returned_movements.extend(movements if isinstance(movements, list) else [movements])
                else:
                    unit_return_cost = invoice_item.unit_cost if getattr(invoice_item, 'unit_cost', Decimal('0.00')) > Decimal('0.00') else product_obj.purchase_price
                    return_date_val = return_payload.get('return_date') or invoice.invoice_date
                    movements = StockService.process_stock_in(
                        product=product_obj,
                        quantity=ret_qty,
                        movement_type='SALES_RETURN',
                        reference_type='SALES_RETURN',
                        reference_id=invoice.invoice_number,
                        unit_cost=unit_return_cost,
                        unit_price=line_unit_rate,
                        notes=item_data.get('reason', f"Customer Sales Return for Invoice #{invoice.invoice_number}"),
                        user=user,
                        movement_date=return_date_val
                    )
                    if movements:
                        returned_movements.extend(movements if isinstance(movements, list) else [movements])

        # Adjust customer balance due if outstanding
        if invoice.balance_due_amount > Decimal('0.00'):
            invoice.balance_due_amount = max(Decimal('0.00'), invoice.balance_due_amount - total_refund_value)
            if invoice.balance_due_amount == Decimal('0.00') and invoice.total_paid_amount > Decimal('0.00'):
                invoice.payment_status = 'PAID'
            elif invoice.total_paid_amount > Decimal('0.00'):
                invoice.payment_status = 'PARTIALLY_PAID'
            else:
                invoice.payment_status = 'UNPAID'
        invoice.save()

        return {
            'invoice_number': invoice.invoice_number,
            'message': f"Sales return processed successfully for Invoice #{invoice.invoice_number}.",
            'movements_created': len(returned_movements),
            'total_refund_value': total_refund_value
        }

