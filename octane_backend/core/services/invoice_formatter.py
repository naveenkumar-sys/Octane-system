from core.models import BusinessProfile, Customer
from core.services.tax_engine import TaxEngine


class InvoiceFormatter:
    """
    Formats complete Invoice print payload strictly for A4 format
    matching the Matrix Infotech sample invoice layout.
    """

    @staticmethod
    def format_invoice_print_data(invoice_number, invoice_date, customer_obj, items_raw_data, 
                                   seller_profile=None, delivery_note='', mode_of_payment='Cash', 
                                   reference_no='', buyer_order_no='', dispatch_doc_no='', 
                                   dispatched_through='', destination='', terms_of_delivery=''):
        
        if not seller_profile:
            seller_profile, _ = BusinessProfile.objects.get_or_create(id=1)

        tax_results = TaxEngine.calculate_invoice_taxes(
            items_data=items_raw_data,
            seller_state_code=seller_profile.state_code,
            buyer_state_code=customer_obj.state_code if customer_obj else seller_profile.state_code
        )

        buyer_data = {
            'name': customer_obj.name if customer_obj else 'Cash Customer',
            'mobile': customer_obj.mobile if customer_obj else '',
            'email': customer_obj.email if customer_obj else '',
            'gstin': customer_obj.gstin if customer_obj else '',
            'address_line1': customer_obj.billing_address_line1 if customer_obj else '',
            'address_line2': customer_obj.billing_address_line2 if customer_obj else '',
            'city': customer_obj.city if customer_obj else seller_profile.city,
            'pincode': customer_obj.pincode if customer_obj else '',
            'state_name': customer_obj.state_name if customer_obj else seller_profile.state_name,
            'state_code': customer_obj.state_code if customer_obj else seller_profile.state_code,
        }

        seller_data = {
            'company_name': seller_profile.company_name,
            'address_line1': seller_profile.address_line1,
            'address_line2': seller_profile.address_line2,
            'city': seller_profile.city,
            'pincode': seller_profile.pincode,
            'phone': seller_profile.phone,
            'email': seller_profile.email,
            'gstin': seller_profile.gstin,
            'state_name': seller_profile.state_name,
            'state_code': seller_profile.state_code,
            'bank_name': seller_profile.bank_name,
            'account_number': seller_profile.account_number,
            'branch_name': seller_profile.branch_name,
            'ifsc_code': seller_profile.ifsc_code,
            'declaration': seller_profile.declaration,
            'jurisdiction_text': seller_profile.jurisdiction_text,
        }

        metadata_grid = {
            'invoice_number': invoice_number,
            'invoice_date': invoice_date,
            'delivery_note': delivery_note,
            'mode_of_payment': mode_of_payment,
            'reference_no': reference_no,
            'buyer_order_no': buyer_order_no,
            'dispatch_doc_no': dispatch_doc_no,
            'dispatched_through': dispatched_through,
            'destination': destination,
            'terms_of_delivery': terms_of_delivery or seller_profile.terms_of_delivery,
        }

        return {
            'paper_format': 'A4',
            'copies': [
                {'copy_type': 'ORIGINAL FOR RECIPIENT', 'page_number': 1},
                {'copy_type': 'DUPLICATE FOR TRANSPORTER', 'page_number': 2},
            ],
            'seller': seller_data,
            'buyer': buyer_data,
            'metadata': metadata_grid,
            'items': tax_results['items'],
            'is_intra_state': tax_results['is_intra_state'],
            'subtotal': tax_results['subtotal'],
            'taxable_amount': tax_results['taxable_amount'],
            'total_cgst': tax_results['total_cgst'],
            'total_sgst': tax_results['total_sgst'],
            'total_igst': tax_results['total_igst'],
            'total_tax': tax_results['total_tax'],
            'grand_total': tax_results['grand_total'],
            'amount_in_words': tax_results['amount_in_words'],
            'tax_amount_in_words': tax_results['tax_amount_in_words'],
            'hsn_summary': tax_results['hsn_summary'],
        }
