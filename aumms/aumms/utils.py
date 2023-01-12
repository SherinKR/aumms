import frappe
from frappe.utils import *
from frappe import _

@frappe.whitelist()
def get_board_rate(date, time, item_type, uom, purity=None):
    ''' Method to get Board Rate '''
    board_rate = 0
    if purity:
        filters = { 'docstatus': '1', 'item_type': item_type, 'date':getdate(date), 'time': [ '<=', time ], 'purity': purity }
    else:
        filters = { 'docstatus': '1', 'item_type': item_type, 'date':getdate(date), 'time': [ '<=', time ] }
    if frappe.db.get_all('Board Rate', filters=filters):
        board_rate_doc = frappe.get_last_doc('Board Rate', filters=filters)
        board_rate = board_rate_doc.board_rate
    return board_rate

@frappe.whitelist()
def create_metal_ledger_entries(doc, method=None):
    """
        method to create metal ledger entries
        args:
            doc: object of purchase Receipt doctype
            method: on submit of purchase reciept
        output:
            new metal ledger entry doc
    """

    # get default company
    company = frappe.defaults.get_defaults().company

    # set dict of fields for metal ledger entry
    fields = {
        'doctype': 'Metal Ledger Entry',
        'posting_date': doc.posting_date,
        'posting_time': doc.posting_time,
        'voucher_type': doc.doctype,
        'voucher_no': doc.name,
        'company': company
    }

    # set party type and party in fields if doctype is Purchase Receipt
    if doc.doctype == 'Purchase Receipt':
        fields['party_type'] = 'Supplier'
        fields['party'] = doc.supplier

    # declare ledger_created as false
    ledger_created = 0
    for item in doc.items:
        # check item is a metal transaction
        if item.is_metal_transaction:

            # set item details in fields
            fields['item_code'] = item.item_code
            fields['item_name'] = item.item_name
            fields['stock_uom'] = item.stock_uom
            fields['purity'] = item.purity
            fields['purity_percentage'] = item.purity_percentage
            fields['qty'] = item.stock_qty
            fields['board_rate'] = item.rate
            fields['outgoing_rate'] = item.rate
            fields['batch_no'] = item.batch_no
            fields['item_type'] = item.item_type
            fields['amount'] = item.amount

            # create metal ledger entry doc with fields
            frappe.get_doc(fields).insert(ignore_permissions = 1)
            ledger_created = 1

    # alert message if metal ledger is created
    if ledger_created:
        frappe.msgprint(
            msg = _(
                'Metal Ledger Entry is created.'
            ),
            alert = 1
        )