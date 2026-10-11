from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from core.models import Supplier, Product, Partner, Purchase, PurchaseItem, SerialNumber, StockMovement, SupplierPayment
from core.services.stock_service import StockService


class PurchaseService:
    """
    Transactional Business Service for Vendor Stock Purchases, Purchase Returns, and Supplier Payments.
    """

    @staticmethod
    @transaction.atomic
    def create_and_post_purchase(user, payload):
        """
        Creates a vendor stock purchase and automatically triggers Stock IN for all physical items.
        """
        items_raw = payload.get('items', [])
        if not items_raw:
            raise ValidationError("Purchase must contain at least one item line.")

        supplier_id = payload.get('supplier_id')
        supplier_obj = None
        if supplier_id:
            supplier_obj = Supplier.objects.filter(id=supplier_id).first()
            if not supplier_obj:
                raise ValidationError("Selected supplier does not exist.")
            if not supplier_obj.is_active:
                raise ValidationError(f"Supplier '{supplier_obj.name}' is inactive and cannot be used for purchase.")

        # Check duplicate vendor invoice for supplier
        supplier_invoice_num = (payload.get('supplier_invoice_number') or '').strip()
        if supplier_obj and supplier_invoice_num:
            if Purchase.objects.filter(supplier=supplier_obj, supplier_invoice_number=supplier_invoice_num).exists():
                raise ValidationError(f"Purchase invoice '{supplier_invoice_num}' already exists for supplier '{supplier_obj.name}'.")

        paid_by_partner_id = payload.get('paid_by_partner_id')
        partner_obj = Partner.objects.filter(id=paid_by_partner_id).first() if paid_by_partner_id else None

        # Pre-validate all items before DB mutation
        for item in items_raw:
            product_id = item.get('product_id')
            if not product_id:
                raise ValidationError("Each item line must specify a valid product_id.")

            product_obj = Product.objects.filter(id=product_id).first()
            if not product_obj:
                raise ValidationError(f"Product with ID {product_id} does not exist.")

            if not product_obj.is_active:
                raise ValidationError(f"Product '{product_obj.name}' is inactive and cannot be purchased.")

            try:
                qty = int(item.get('quantity', 1))
            except (TypeError, ValueError):
                raise ValidationError(f"Invalid quantity for product '{product_obj.name}'.")

            if qty <= 0:
                raise ValidationError(f"Purchase quantity for '{product_obj.name}' must be greater than zero.")

            unit_cost = Decimal(str(item.get('unit_cost', 0)))
            if unit_cost < Decimal('0.00'):
                raise ValidationError(f"Unit cost for '{product_obj.name}' cannot be negative.")

        # Auto-generate purchase number (PUR-YYYY-00001)
        year = timezone.now().year
        purchase_count = Purchase.objects.count() + 1
        purchase_num = f"PUR-{year}-{purchase_count:05d}"

        # Calculate totals
        total_amount = Decimal('0.00')
        total_tax = Decimal('0.00')

        for item in items_raw:
            qty = Decimal(str(item.get('quantity', 1)))
            unit_cost = Decimal(str(item.get('unit_cost', 0)))
            gst_rate = Decimal(str(item.get('gst_rate', 18)))
            
            line_cost = qty * unit_cost
            line_tax = (line_cost * gst_rate) / Decimal('100')
            line_total = line_cost + line_tax

            total_amount += line_total
            total_tax += line_tax

        payment_mode = payload.get('payment_mode', 'CASH')
        partner_split_json = payload.get('partner_split_json')

        # Validate partner out-of-pocket funding
        if payment_mode == 'PARTNER_OUT_OF_POCKET':
            if not partner_obj and not partner_split_json:
                raise ValidationError("Please select the partner who funded this purchase out-of-pocket, or provide a partner split breakdown.")
            if partner_obj and not partner_obj.is_active:
                raise ValidationError(f"Partner '{partner_obj.name}' is inactive and cannot fund purchases.")
            if partner_split_json and isinstance(partner_split_json, dict):
                for p_name_or_id in partner_split_json.keys():
                    p_match = Partner.objects.filter(
                        Q(name__iexact=str(p_name_or_id).strip()) | Q(id=int(p_name_or_id) if str(p_name_or_id).isdigit() else -1)
                    ).first()
                    if not p_match:
                        raise ValidationError(f"Partner '{p_name_or_id}' specified in split breakdown does not exist.")
                    if not p_match.is_active:
                        raise ValidationError(f"Partner '{p_match.name}' is inactive.")

        # Validate payment amounts
        if 'paid_amount' in payload and payload['paid_amount'] is not None:
            paid_amt = Decimal(str(payload['paid_amount']))
        elif payment_mode == 'CREDIT':
            paid_amt = Decimal('0.00')
        else:
            paid_amt = total_amount

        if paid_amt < Decimal('0.00'):
            raise ValidationError("Paid amount cannot be negative.")
        if paid_amt > total_amount:
            raise ValidationError(f"Paid amount (₹{paid_amt}) cannot exceed purchase total (₹{total_amount}).")

        payment_status = 'PAID' if paid_amt >= total_amount else ('PARTIALLY_PAID' if paid_amt > Decimal('0.00') else 'UNPAID')

        # 1. Create Purchase Header
        purchase = Purchase.objects.create(
            purchase_number=purchase_num,
            supplier=supplier_obj,
            supplier_invoice_number=supplier_invoice_num,
            purchase_date=payload.get('purchase_date', timezone.now().date()),
            total_amount=total_amount,
            tax_amount=total_tax,
            paid_amount=paid_amt,
            payment_mode=payment_mode,
            paid_by_partner=partner_obj,
            partner_split_json=partner_split_json,
            payment_status=payment_status,
            notes=payload.get('notes', ''),
            created_by=user
        )

        # 1b. If business paid an upfront amount to supplier (store cash/bank/UPI)
        if paid_amt > Decimal('0.00') and payment_mode != 'PARTNER_OUT_OF_POCKET' and not partner_obj and supplier_obj:
            valid_p_mode = payment_mode if payment_mode in ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'] else 'CASH'
            payment_counter = 1
            payment_num = f"PAY-PUR-{purchase.purchase_number}-{payment_counter}"
            while SupplierPayment.objects.filter(payment_number=payment_num).exists():
                payment_counter += 1
                payment_num = f"PAY-PUR-{purchase.purchase_number}-{payment_counter}"

            SupplierPayment.objects.create(
                payment_number=payment_num,
                supplier=supplier_obj,
                purchase=purchase,
                payment_date=purchase.purchase_date,
                payment_mode=valid_p_mode,
                amount=paid_amt,
                reference_number=payload.get('reference_number', ''),
                notes=f"Upfront payment for Purchase #{purchase.purchase_number}",
                created_by=user
            )

        # 2. Create Purchase Items & Trigger Stock IN
        for item in items_raw:
            product_obj = Product.objects.get(id=item['product_id'])
            qty = int(item.get('quantity', 1))
            unit_cost = Decimal(str(item.get('unit_cost', 0)))
            gst_rate = Decimal(str(item.get('gst_rate', 18)))

            line_cost = Decimal(str(qty)) * unit_cost
            line_tax = (line_cost * gst_rate) / Decimal('100')
            line_total = line_cost + line_tax

            serials_text = item.get('serial_numbers_text', '')
            serial_list = [s.strip() for s in serials_text.split(',') if s.strip()] if serials_text else []

            PurchaseItem.objects.create(
                purchase=purchase,
                product=product_obj,
                description=item.get('description', product_obj.name),
                hsn_sac=item.get('hsn_sac', product_obj.hsn_sac),
                quantity=qty,
                unit_cost=unit_cost,
                gst_rate=gst_rate,
                total_amount=line_total,
                serial_numbers_text=serials_text
            )

            # Trigger Stock IN for physical product
            StockService.process_stock_in(
                product=product_obj,
                quantity=qty,
                movement_type='PURCHASE',
                reference_type='PURCHASE',
                reference_id=purchase.purchase_number,
                serial_numbers_list=serial_list,
                unit_cost=unit_cost,
                notes=f"Supplier Purchase #{purchase.purchase_number}",
                user=user,
                movement_date=purchase.purchase_date
            )

        return purchase

    @staticmethod
    @transaction.atomic
    def process_purchase_return(user, purchase_id, return_payload):
        """
        Processes a supplier purchase return atomically:
        1. Validates purchase and items returned.
        2. Validates return quantities do not exceed original purchase item quantity minus previous returns.
        3. Checks current stock availability for the product before returning to supplier.
        4. For physical products:
           - Quantity tracking: triggers Stock OUT via StockMovement(PURCHASE_RETURN).
           - Serial tracking: validates serial status is AVAILABLE, marks status as DEFECTIVE, triggers Stock OUT.
        5. Reduces supplier outstanding balance/payable.
        """
        purchase = Purchase.objects.select_for_update().get(id=purchase_id)

        items_to_return = return_payload.get('items', [])
        if not items_to_return:
            raise ValidationError("Purchase return request must specify at least one item to return.")

        returned_movements = []
        serials_processed = set()
        total_return_value = Decimal('0.00')
        total_return_tax = Decimal('0.00')

        for item_data in items_to_return:
            item_id = item_data.get('purchase_item_id')
            purchase_item = purchase.items.filter(id=item_id).first() if item_id else None

            if not purchase_item:
                p_id = item_data.get('product_id')
                if p_id:
                    purchase_item = purchase.items.filter(product_id=p_id).first()

            if not purchase_item:
                raise ValidationError(f"Specified item (ID: {item_id}) does not belong to Purchase #{purchase.purchase_number}.")

            try:
                ret_qty = int(item_data.get('quantity', 1))
            except (TypeError, ValueError):
                raise ValidationError(f"Return quantity for '{purchase_item.description}' must be a valid positive integer.")

            if ret_qty <= 0:
                raise ValidationError("Return quantity must be greater than zero.")

            # Calculate total previously returned quantity for this purchase item
            prev_movements = StockMovement.objects.filter(
                reference_type='PURCHASE_RETURN',
                reference_id=purchase.purchase_number,
                product=purchase_item.product
            )
            previously_returned_qty = prev_movements.aggregate(total=Sum('quantity'))['total'] or 0

            if (previously_returned_qty + ret_qty) > purchase_item.quantity:
                raise ValidationError(
                    f"Cannot return {ret_qty} units of '{purchase_item.product.name}'. "
                    f"Purchased: {purchase_item.quantity}, Already Returned: {previously_returned_qty}."
                )

            # Check stock availability for product
            product_obj = purchase_item.product
            curr_stock = product_obj.get_current_stock()
            if curr_stock < ret_qty:
                raise ValidationError(
                    f"Cannot return {ret_qty} units of '{product_obj.name}' to supplier. Available current stock is only {curr_stock}."
                )

            unit_cost = purchase_item.unit_cost
            gst_rate = purchase_item.gst_rate
            unit_tax = (unit_cost * gst_rate) / Decimal('100')
            unit_total_cost = unit_cost + unit_tax
            total_return_value += (Decimal(str(ret_qty)) * unit_total_cost)
            total_return_tax += (Decimal(str(ret_qty)) * unit_tax)

            if product_obj.tracking_type == 'SERIAL_NUMBER':
                serial_str = (item_data.get('serial_number') or '').strip()
                if not serial_str:
                    raise ValidationError(f"Serial number is required for returning product '{product_obj.name}' to supplier.")

                if serial_str in serials_processed:
                    raise ValidationError(f"Duplicate serial number '{serial_str}' submitted in return request.")
                serials_processed.add(serial_str)

                serial_obj = SerialNumber.objects.select_for_update().filter(
                    product=product_obj,
                    serial_number=serial_str
                ).first()

                if not serial_obj:
                    raise ValidationError(f"Serial number '{serial_str}' does not exist for product '{product_obj.name}'.")

                if serial_obj.status != 'AVAILABLE':
                    raise ValidationError(
                        f"Serial number '{serial_str}' cannot be returned to supplier because its status is '{serial_obj.status}' (must be 'AVAILABLE')."
                    )

                return_date_val = return_payload.get('return_date') or purchase.purchase_date
                movement = StockService.process_stock_out(
                    product=product_obj,
                    quantity=1,
                    movement_type='PURCHASE_RETURN',
                    reference_type='PURCHASE_RETURN',
                    reference_id=purchase.purchase_number,
                    serial_number_str=serial_str,
                    unit_cost=purchase_item.unit_cost,
                    unit_price=purchase_item.unit_cost,
                    notes=item_data.get('reason', f"Supplier Purchase Return for Purchase #{purchase.purchase_number}"),
                    user=user,
                    movement_date=return_date_val
                )
                if movement:
                    returned_movements.append(movement)
            else:
                return_date_val = return_payload.get('return_date') or purchase.purchase_date
                movement = StockService.process_stock_out(
                    product=product_obj,
                    quantity=ret_qty,
                    movement_type='PURCHASE_RETURN',
                    reference_type='PURCHASE_RETURN',
                    reference_id=purchase.purchase_number,
                    unit_cost=purchase_item.unit_cost,
                    unit_price=purchase_item.unit_cost,
                    notes=item_data.get('reason', f"Supplier Purchase Return for Purchase #{purchase.purchase_number}"),
                    user=user,
                    movement_date=return_date_val
                )
                if movement:
                    returned_movements.append(movement)

        # Reduce purchase total amount and tax amount / supplier payable
        purchase.total_amount = max(Decimal('0.00'), purchase.total_amount - total_return_value)
        if 'total_return_tax' in locals():
            purchase.tax_amount = max(Decimal('0.00'), purchase.tax_amount - total_return_tax)
        if purchase.paid_amount >= purchase.total_amount:
            purchase.payment_status = 'PAID'
        purchase.save()

        return {
            'purchase_number': purchase.purchase_number,
            'message': f"Purchase return processed successfully for Purchase #{purchase.purchase_number}.",
            'movements_created': len(returned_movements),
            'total_return_value': total_return_value
        }

    @staticmethod
    @transaction.atomic
    def record_supplier_payment(user, purchase_id, payment_payload):
        """
        Records a delayed supplier payment against a purchase or supplier credit balance.
        """
        purchase = Purchase.objects.select_for_update().get(id=purchase_id)
        if not purchase.supplier:
            raise ValidationError("Cannot record supplier payment for a purchase without an assigned supplier.")

        amount = Decimal(str(payment_payload.get('amount', 0)))
        if amount <= Decimal('0.00'):
            raise ValidationError("Payment amount must be greater than zero.")

        outstanding = purchase.total_amount - purchase.paid_amount
        if amount > outstanding:
            raise ValidationError(f"Payment amount (₹{amount}) exceeds remaining outstanding payable (₹{outstanding}).")

        pay_count = purchase.supplier_payments.count() + 1
        payment_num = f"PAY-PUR-{purchase.purchase_number}-{pay_count}"
        while SupplierPayment.objects.filter(payment_number=payment_num).exists():
            pay_count += 1
            payment_num = f"PAY-PUR-{purchase.purchase_number}-{pay_count}"

        payment = SupplierPayment.objects.create(
            payment_number=payment_num,
            supplier=purchase.supplier,
            purchase=purchase,
            payment_date=payment_payload.get('payment_date', timezone.now().date()),
            payment_mode=payment_payload.get('payment_mode', 'CASH'),
            amount=amount,
            reference_number=payment_payload.get('reference_number', ''),
            notes=payment_payload.get('notes', f"Supplier payment for Purchase #{purchase.purchase_number}"),
            created_by=user
        )

        purchase.paid_amount += amount
        if purchase.paid_amount >= purchase.total_amount:
            purchase.payment_status = 'PAID'
        else:
            purchase.payment_status = 'PARTIALLY_PAID'

        purchase.save()
        return payment
