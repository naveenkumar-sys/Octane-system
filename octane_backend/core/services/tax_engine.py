from decimal import Decimal, ROUND_HALF_UP


def amount_to_words_indian(number):
    """
    Converts a decimal or integer amount to Indian Rupees format in words.
    Example: 2478.00 -> 'Indian Rupees Two Thousand Four Hundred Seventy Eight Only'
    """
    if number is None or number < 0:
        return "Zero"

    units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
    teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def convert_below_thousand(n):
        res = ""
        if n >= 100:
            res += units[n // 100] + " Hundred "
            n %= 100
        if n >= 20:
            res += tens[n // 10] + " "
            n %= 10
        elif n >= 10:
            res += teens[n - 10] + " "
            n = 0
        if n > 0:
            res += units[n] + " "
        return res

    amount = Decimal(str(number)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    rupees = int(amount)
    paise = int((amount - rupees) * 100)

    if rupees == 0:
        rupees_str = "Zero"
    else:
        parts = []
        
        # Crores (1,00,00,000)
        crores = rupees // 10000000
        rupees %= 10000000
        if crores > 0:
            parts.append(convert_below_thousand(crores).strip() + " Crore")

        # Lakhs (1,00,000)
        lakhs = rupees // 100000
        rupees %= 100000
        if lakhs > 0:
            parts.append(convert_below_thousand(lakhs).strip() + " Lakh")

        # Thousands (1,000)
        thousands = rupees // 1000
        rupees %= 1000
        if thousands > 0:
            parts.append(convert_below_thousand(thousands).strip() + " Thousand")

        # Hundreds & Remaining
        if rupees > 0:
            parts.append(convert_below_thousand(rupees).strip())

        rupees_str = " ".join(parts)

    words = f"Indian Rupees {rupees_str}"
    
    if paise > 0:
        paise_str = convert_below_thousand(paise).strip()
        words += f" and {paise_str} Paise"

    words += " Only"
    return words


class TaxEngine:
    """
    Backend-authoritative GST calculation engine.
    """

    @staticmethod
    def calculate_item_tax(rate, qty, discount_pct, gst_rate, is_intra_state=True):
        """
        Calculates line-item taxable value, CGST, SGST, IGST, and line total.
        """
        rate = Decimal(str(rate))
        qty = Decimal(str(qty))
        discount_pct = Decimal(str(discount_pct or 0))
        gst_rate = Decimal(str(gst_rate or 0))

        gross_amount = rate * qty
        discount_amount = (gross_amount * discount_pct) / Decimal('100')
        taxable_value = gross_amount - discount_amount

        if is_intra_state:
            cgst_rate = gst_rate / Decimal('2')
            sgst_rate = gst_rate / Decimal('2')
            igst_rate = Decimal('0')

            cgst_amount = (taxable_value * cgst_rate) / Decimal('100')
            sgst_amount = (taxable_value * sgst_rate) / Decimal('100')
            igst_amount = Decimal('0')
        else:
            cgst_rate = Decimal('0')
            sgst_rate = Decimal('0')
            igst_rate = gst_rate

            cgst_amount = Decimal('0')
            sgst_amount = Decimal('0')
            igst_amount = (taxable_value * igst_rate) / Decimal('100')

        total_tax = cgst_amount + sgst_amount + igst_amount
        total_amount = taxable_value + total_tax

        return {
            'rate': rate.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'qty': qty,
            'discount_pct': discount_pct,
            'taxable_value': taxable_value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'gst_rate': gst_rate,
            'cgst_rate': cgst_rate,
            'cgst_amount': cgst_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'sgst_rate': sgst_rate,
            'sgst_amount': sgst_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'igst_rate': igst_rate,
            'igst_amount': igst_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'total_tax': total_tax.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'total_amount': total_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        }

    @staticmethod
    def calculate_invoice_taxes(items_data, seller_state_code="29", buyer_state_code="29"):
        """
        Calculates complete invoice totals, state tax breakdown, HSN/SAC summary, and amounts in words.
        """
        is_intra_state = str(seller_state_code).strip() == str(buyer_state_code).strip()

        calculated_items = []
        subtotal = Decimal('0')
        total_discount = Decimal('0')
        total_taxable = Decimal('0')
        total_cgst = Decimal('0')
        total_sgst = Decimal('0')
        total_igst = Decimal('0')
        total_tax = Decimal('0')
        grand_total = Decimal('0')

        hsn_summary_dict = {}

        for item in items_data:
            item_rate = item.get('rate') if item.get('rate') is not None else (item.get('selling_price') if item.get('selling_price') is not None else item.get('unit_price', 0))
            item_qty = item.get('qty') if item.get('qty') is not None else item.get('quantity', 1)
            item_disc = item.get('discount') if item.get('discount') is not None else item.get('discount_pct', 0)
            calc = TaxEngine.calculate_item_tax(
                rate=item_rate,
                qty=item_qty,
                discount_pct=item_disc,
                gst_rate=item.get('gst_rate', 18),
                is_intra_state=is_intra_state
            )

            calculated_item = {**item, **calc}
            calculated_items.append(calculated_item)

            total_taxable += calc['taxable_value']
            total_cgst += calc['cgst_amount']
            total_sgst += calc['sgst_amount']
            total_igst += calc['igst_amount']
            total_tax += calc['total_tax']
            grand_total += calc['total_amount']

            # HSN/SAC aggregation
            hsn_key = f"{item.get('hsn_sac', '852411')}_{calc['gst_rate']}"
            if hsn_key not in hsn_summary_dict:
                hsn_summary_dict[hsn_key] = {
                    'hsn_sac': item.get('hsn_sac', '852411'),
                    'taxable_value': Decimal('0'),
                    'cgst_rate': calc['cgst_rate'],
                    'cgst_amount': Decimal('0'),
                    'sgst_rate': calc['sgst_rate'],
                    'sgst_amount': Decimal('0'),
                    'igst_rate': calc['igst_rate'],
                    'igst_amount': Decimal('0'),
                    'total_tax_amount': Decimal('0'),
                }

            hsn_summary_dict[hsn_key]['taxable_value'] += calc['taxable_value']
            hsn_summary_dict[hsn_key]['cgst_amount'] += calc['cgst_amount']
            hsn_summary_dict[hsn_key]['sgst_amount'] += calc['sgst_amount']
            hsn_summary_dict[hsn_key]['igst_amount'] += calc['igst_amount']
            hsn_summary_dict[hsn_key]['total_tax_amount'] += calc['total_tax']

        hsn_summary_list = list(hsn_summary_dict.values())

        return {
            'is_intra_state': is_intra_state,
            'items': calculated_items,
            'subtotal': total_taxable.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'taxable_amount': total_taxable.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'total_cgst': total_cgst.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'total_sgst': total_sgst.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'total_igst': total_igst.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'total_tax': total_tax.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'grand_total': grand_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'amount_in_words': amount_to_words_indian(grand_total),
            'tax_amount_in_words': amount_to_words_indian(total_tax),
            'hsn_summary': hsn_summary_list,
        }
