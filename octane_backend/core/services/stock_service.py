from decimal import Decimal
from django.db import transaction
from rest_framework.exceptions import ValidationError
from core.models import Product, SerialNumber, StockMovement


class StockService:
    """
    Transactional Business Service for Stock & Inventory movements.
    """

    @staticmethod
    def validate_stock(product, quantity, serial_number_str=None, movement_type='SALE'):
        """
        Validates stock availability before processing a sale or stock-out transaction.
        Raises ValidationError if stock is insufficient or serial number is invalid/already sold.
        Uses select_for_update for concurrency locking when inside transaction block.
        """
        if not product.is_stock_enabled:
            return True  # Services or non-stock items pass validation

        # Acquire lock on product row if transaction is active
        try:
            if transaction.get_connection().in_atomic_block:
                locked_product = Product.objects.select_for_update().get(id=product.id)
            else:
                locked_product = Product.objects.get(id=product.id)
        except Product.DoesNotExist:
            locked_product = product

        available_stock = locked_product.get_current_stock()
        if available_stock < quantity:
            raise ValidationError(
                f"Insufficient stock for product '{product.name}'. "
                f"Available stock: {available_stock}, Requested: {quantity}."
            )

        # Serial number validation for serial-tracked items
        if product.tracking_type == 'SERIAL_NUMBER':
            if not serial_number_str:
                raise ValidationError(
                    f"A serial number barcode is required to process stock for '{product.name}' because it has serial tracking enabled."
                )
            serial_qs = SerialNumber.objects.filter(
                product=product, 
                serial_number=str(serial_number_str).strip()
            )
            if transaction.get_connection().in_atomic_block:
                serial_qs = serial_qs.select_for_update()
            serial_obj = serial_qs.first()

            if not serial_obj:
                raise ValidationError(
                    f"Serial number '{serial_number_str}' does not exist for product '{product.name}'."
                )
            if movement_type in ['PURCHASE_RETURN', 'ADJUSTMENT_OUT']:
                if serial_obj.status not in ['AVAILABLE', 'RETURNED']:
                    raise ValidationError(
                        f"Serial number '{serial_number_str}' for product '{product.name}' cannot be adjusted or returned because its status is '{serial_obj.status}'."
                    )
            else:
                if serial_obj.status not in ['AVAILABLE', 'RETURNED']:
                    raise ValidationError(
                        f"Serial number '{serial_number_str}' for product '{product.name}' is already {serial_obj.status}."
                    )

        return True

    @staticmethod
    @transaction.atomic
    def process_stock_in(product, quantity, movement_type, reference_type, reference_id=None, 
                         serial_numbers_list=None, unit_cost=0, unit_price=0, notes='', user=None, movement_date=None):
        """
        Processes Stock IN (Opening Stock, Vendor Purchase, Sales Return, Stock Adjustment In).
        Updates/Creates SerialNumbers as AVAILABLE or RETURNED.
        """
        if not product.is_stock_enabled:
            return None  # Skip non-stock items

        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            raise ValidationError("Stock IN quantity must be a valid positive integer.")

        if quantity <= 0:
            raise ValidationError("Stock IN quantity must be greater than zero.")

        valid_in_types = ['OPENING', 'PURCHASE', 'SALES_RETURN', 'ADJUSTMENT_IN']
        if movement_type not in valid_in_types:
            raise ValidationError(f"Invalid Stock IN movement type: {movement_type}")

        movements = []
        raw_serials = serial_numbers_list or []
        clean_serials = [str(s).strip() for s in raw_serials if str(s).strip()]

        if product.tracking_type == 'SERIAL_NUMBER':
            if len(clean_serials) != quantity:
                raise ValidationError(
                    f"For serial-tracked product '{product.name}', exactly {quantity} serial number(s) must be provided (received {len(clean_serials)})."
                )

            # Check duplicate serials within input batch
            if len(clean_serials) != len(set(clean_serials)):
                raise ValidationError(f"Duplicate serial numbers submitted in batch for product '{product.name}'.")

            if movement_type == 'SALES_RETURN':
                for s_num_clean in clean_serials:
                    serial_obj = SerialNumber.objects.select_for_update().filter(
                        product=product, 
                        serial_number=s_num_clean
                    ).first()

                    if not serial_obj:
                        raise ValidationError(f"Serial number '{s_num_clean}' does not exist for product '{product.name}'.")

                    serial_obj.status = 'RETURNED'
                    serial_obj.save()

                    movement = StockMovement.objects.create(
                        product=product,
                        movement_type=movement_type,
                        quantity=1,
                        reference_type=reference_type,
                        reference_id=str(reference_id) if reference_id else None,
                        serial_number=serial_obj,
                        unit_cost=unit_cost,
                        unit_price=unit_price,
                        notes=notes,
                        created_by=user
                    )
                    movements.append(movement)
            else:
                # Check if any serial already exists in database for this product
                existing_serials = set(SerialNumber.objects.filter(
                    product=product, 
                    serial_number__in=clean_serials
                ).values_list('serial_number', flat=True))

                if existing_serials:
                    dup_str = ", ".join(sorted(existing_serials))
                    raise ValidationError(f"Serial number(s) already exist for product '{product.name}': {dup_str}")

                for s_num_clean in clean_serials:
                    serial_obj = SerialNumber.objects.create(
                        product=product,
                        serial_number=s_num_clean,
                        status='AVAILABLE',
                        purchase_reference=f"{reference_type}-{reference_id}" if reference_id else reference_type
                    )

                    movement = StockMovement.objects.create(
                        product=product,
                        movement_type=movement_type,
                        quantity=1,
                        reference_type=reference_type,
                        reference_id=str(reference_id) if reference_id else None,
                        serial_number=serial_obj,
                        unit_cost=unit_cost,
                        unit_price=unit_price,
                        notes=notes,
                        created_by=user
                    )
                    movements.append(movement)
        else:
            movement = StockMovement.objects.create(
                product=product,
                movement_type=movement_type,
                quantity=quantity,
                reference_type=reference_type,
                reference_id=str(reference_id) if reference_id else None,
                unit_cost=unit_cost,
                unit_price=unit_price,
                notes=notes,
                created_by=user
            )
            movements.append(movement)

        if movement_date:
            import datetime
            from django.utils import timezone
            if isinstance(movement_date, str):
                movement_date = datetime.date.fromisoformat(movement_date)
            dt = timezone.make_aware(datetime.datetime.combine(movement_date, datetime.time(12, 0, 0)))
            for m in movements:
                StockMovement.objects.filter(id=m.id).update(created_at=dt)
                m.created_at = dt

        return movements


    @staticmethod
    def get_product_unit_cost(product, serial_number_str=None):
        """
        Determines the accurate inventory acquisition cost for a product:
        1. For serial-tracked products: finds inward movement unit_cost for that specific serial number.
        2. For quantity-tracked products: finds latest inward movement (PURCHASE/OPENING) with positive unit_cost.
        3. Fallback: product.purchase_price from catalog.
        """
        if not product or not getattr(product, 'is_stock_enabled', True):
            return Decimal('0.00')

        if serial_number_str:
            inward_serial_mov = StockMovement.objects.filter(
                product=product,
                serial_number__serial_number=str(serial_number_str).strip(),
                movement_type__in=['PURCHASE', 'OPENING', 'ADJUSTMENT_IN'],
                unit_cost__gt=0
            ).order_by('-created_at').first()
            if inward_serial_mov and inward_serial_mov.unit_cost > Decimal('0.00'):
                return inward_serial_mov.unit_cost

        latest_inward = StockMovement.objects.filter(
            product=product,
            movement_type__in=['PURCHASE', 'OPENING', 'ADJUSTMENT_IN'],
            unit_cost__gt=0
        ).order_by('-created_at').first()
        if latest_inward and latest_inward.unit_cost > Decimal('0.00'):
            return latest_inward.unit_cost

        return getattr(product, 'purchase_price', Decimal('0.00')) or Decimal('0.00')

    @staticmethod
    @transaction.atomic
    def process_stock_out(product, quantity, movement_type, reference_type, reference_id=None, 
                          serial_number_str=None, unit_cost=0, unit_price=0, notes='', user=None,
                          movement_date=None):
        """
        Processes Stock OUT (Customer Sale, Purchase Return, Stock Adjustment Out).
        Validates stock and marks SerialNumber as SOLD or DEFECTIVE.
        """
        if not product.is_stock_enabled:
            return None  # Skip non-stock items

        valid_out_types = ['SALE', 'PURCHASE_RETURN', 'ADJUSTMENT_OUT']
        if movement_type not in valid_out_types:
            raise ValidationError(f"Invalid Stock OUT movement type: {movement_type}")

        # 1. Validate Stock
        StockService.validate_stock(product, quantity, serial_number_str, movement_type=movement_type)

        # 2. Update Serial Number status if applicable
        serial_obj = None
        if product.tracking_type == 'SERIAL_NUMBER' and serial_number_str:
            serial_obj = SerialNumber.objects.select_for_update().get(
                product=product, 
                serial_number=str(serial_number_str).strip()
            )
            serial_obj.status = 'DEFECTIVE' if movement_type in ['PURCHASE_RETURN', 'ADJUSTMENT_OUT'] else 'SOLD'
            serial_obj.invoice_reference = f"{reference_type}-{reference_id}"
            serial_obj.save()

        # 3. Resolve unit cost if not explicitly passed
        resolved_cost = Decimal(str(unit_cost or 0))
        if resolved_cost <= Decimal('0.00'):
            resolved_cost = StockService.get_product_unit_cost(product, serial_number_str)

        # 4. Create StockMovement entry
        movement = StockMovement.objects.create(
            product=product,
            movement_type=movement_type,
            quantity=quantity,
            reference_type=reference_type,
            reference_id=str(reference_id) if reference_id else None,
            serial_number=serial_obj,
            unit_cost=resolved_cost,
            unit_price=unit_price,
            notes=notes,
            created_by=user
        )

        if movement_date:
            import datetime
            from django.utils import timezone
            if isinstance(movement_date, str):
                movement_date = datetime.date.fromisoformat(movement_date)
            dt = timezone.make_aware(datetime.datetime.combine(movement_date, datetime.time(12, 0, 0)))
            StockMovement.objects.filter(id=movement.id).update(created_at=dt)
            movement.created_at = dt

        return movement

    @staticmethod
    @transaction.atomic
    def adjust_stock(product, new_stock_quantity, reason='', user=None, serial_numbers=None):
        """
        Performs manual inventory count adjustment.
        Creates ADJUSTMENT_IN or ADJUSTMENT_OUT movement.
        Handles both QUANTITY and SERIAL_NUMBER tracked products correctly.
        """
        if not product.is_stock_enabled:
            raise ValidationError(f"Stock tracking is not enabled for product '{product.name}'.")

        current_stock = product.get_current_stock()
        diff = new_stock_quantity - current_stock

        if diff == 0:
            return None  # No change

        raw_serials = serial_numbers or []
        clean_serials = [str(s).strip() for s in raw_serials if str(s).strip()]

        if diff > 0:
            resolved_cost = StockService.get_product_unit_cost(product)
            return StockService.process_stock_in(
                product=product,
                quantity=diff,
                movement_type='ADJUSTMENT_IN',
                reference_type='STOCK_ADJUSTMENT',
                reference_id='MANUAL_ADJ',
                serial_numbers_list=clean_serials if product.tracking_type == 'SERIAL_NUMBER' else None,
                unit_cost=resolved_cost,
                notes=reason or 'Manual physical stock adjustment (In)',
                user=user
            )
        else:
            abs_diff = abs(diff)
            if product.tracking_type == 'SERIAL_NUMBER':
                if clean_serials:
                    if len(clean_serials) != abs_diff:
                        raise ValidationError(
                            f"For serial-tracked product '{product.name}', exactly {abs_diff} serial number(s) must be provided (received {len(clean_serials)})."
                        )
                    movements = []
                    for sn in clean_serials:
                        mov = StockService.process_stock_out(
                            product=product,
                            quantity=1,
                            movement_type='ADJUSTMENT_OUT',
                            reference_type='STOCK_ADJUSTMENT',
                            reference_id='MANUAL_ADJ',
                            serial_number_str=sn,
                            notes=reason or f'Manual physical stock adjustment (Out): {sn}',
                            user=user
                        )
                        movements.append(mov)
                    return movements
                else:
                    # Fallback to FIFO available serials if none explicitly specified
                    available_serials = list(
                        SerialNumber.objects.filter(product=product, status='AVAILABLE')
                        .order_by('created_at')[:abs_diff]
                        .values_list('serial_number', flat=True)
                    )
                    if len(available_serials) < abs_diff:
                        raise ValidationError(
                            f"Insufficient available serial numbers for product '{product.name}'. Required: {abs_diff}, Available: {len(available_serials)}."
                        )
                    movements = []
                    for sn in available_serials:
                        mov = StockService.process_stock_out(
                            product=product,
                            quantity=1,
                            movement_type='ADJUSTMENT_OUT',
                            reference_type='STOCK_ADJUSTMENT',
                            reference_id='MANUAL_ADJ',
                            serial_number_str=sn,
                            notes=reason or f'Manual physical stock adjustment (Out): {sn}',
                            user=user
                        )
                        movements.append(mov)
                    return movements
            else:
                return StockService.process_stock_out(
                    product=product,
                    quantity=abs_diff,
                    movement_type='ADJUSTMENT_OUT',
                    reference_type='STOCK_ADJUSTMENT',
                    reference_id='MANUAL_ADJ',
                    notes=reason or 'Manual physical stock adjustment (Out)',
                    user=user
                )

    @staticmethod
    def sync_missing_serials(product):
        """
        No-op method kept for backward interface compatibility.
        Synthetic serial number auto-generation has been disabled in Phase 3.
        """
        pass

