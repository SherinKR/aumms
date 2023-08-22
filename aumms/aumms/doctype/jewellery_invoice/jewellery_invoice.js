// Copyright (c) 2023, efeone and contributors
// For license information, please see license.txt

frappe.ui.form.on('Jewellery Invoice', {
  setup: function(frm) {
    set_filters(frm);
  },
  transaction_date: function(frm) {
    if (frm.doc.transaction_date ) {
      frm.doc.items.forEach((child) => {
        set_item_details(frm, child);
      });
    }
  },
  customer: function(frm) {
    //method for setting the customer type
    if (frm.doc.customer) {
      frappe.call({
        method : 'aumms.aumms.doc_events.sales_order.set_customer_type',
        args : {
          customer: frm.doc.customer
        },
        callback : function(r) {
          if (r.message) {
            frm.doc.items.forEach((child) => {
              child.customer_type = r.message
            })
          }
        }
      })
    }
  },
  validate: function(frm){
    set_totals(frm);
  },
  disable_rounded_total: function(frm){
    if(frm.doc.disable_rounded_total){
      frm.set_value('rounding_adjustment', 0);
    }
    else{
      frm.set_value('rounded_total', Math.round(frm.doc.grand_total));
      frm.set_value('rounding_adjustment', frm.doc.rounded_total - frm.doc.grand_total);
    }
    frm.set_value('rounded_total', frm.doc.grand_total+frm.doc.rounding_adjustment);
  },
  delivery_date: function(frm){
    if(frm.doc.delivery_date){
      set_missing_delivery_dates(frm);
    }
  },
  refresh: function(frm){
    if(frm.doc.docstatus===1){
      create_custom_buttons(frm);
    }
  },
  onload_post_render: function(frm){
    remove_previous_links(frm);
  },
  aumms_exchange: function(frm){
    set_net_weight_and_amount(frm);
  }
});

frappe.ui.form.on('Old Jewellery Item', {
  item_code: function(frm, cdt, cdn) {
    let d = locals[cdt][cdn];
    if (d.item_code && d.purity && d.stock_uom) {
      frappe.call({
        method: 'aumms.aumms.utils.get_board_rate',
        args: {
            'item_type': d.item_type,
            'date': frm.doc.transaction_date,
            'purity': d.purity,
            'stock_uom': d.stock_uom
        },
        callback: function(r) {
          if (r.message) {
            let board_rate = r.message
            frappe.model.set_value(cdt, cdn, 'board_rate', board_rate);
            frappe.model.set_value(cdt, cdn, 'rate', board_rate)
            frm.refresh_field('old_jewellery_items');
          }
        }
      });
    }
  },
  qty: function(frm, cdt, cdn){
    let d = locals[cdt][cdn];
    let total_old_gold_weight;
    if (d.qty){
      frappe.model.set_value(cdt, cdn, 'amount', d.qty * d.rate);
      frm.refresh_field('old_jewellery_items');
      if(frm.doc.total_old_gold_weight){
        total_old_gold_weight = frm.doc.total_old_gold_weight
      }
      total_old_gold_weight = total_old_gold_weight + d.qty;
      frm.set_value('total_old_gold_weight', total_old_gold_weight);
    }
  },
  rate: function(frm, cdt, cdn){
    let d = locals[cdt][cdn];
    if (d.rate){
      //set amount with rate * qty
      frappe.model.set_value(cdt, cdn, 'amount', d.qty * d.rate);
      frm.refresh_field('old_jewellery_items');
    }
  },
  amount: function(frm){
    set_net_weight_and_amount(frm);
  },
  old_jewellery_items_add: function(frm){
    set_net_weight_and_amount(frm);
  },
  old_jewellery_items_remove: function(frm){
    set_net_weight_and_amount(frm);
  }
});

frappe.ui.form.on('Jewellery Invoice Item', {
 item_code: function(frm, cdt, cdn){
    let d = locals[cdt][cdn];
    if (d.item_code){
      if(frm.doc.delivery_date){
        frappe.model.set_value(d.doctype, d.name, 'delivery_date', frm.doc.delivery_date);
      }
      if (d.is_purity_item){
        frappe.call({
          // Method for fetching  qty, making_charge_percentage, making_charge & board_rate
          method: 'aumms.aumms.doc_events.sales_order.get_item_details',
          args: {
            'item_code': d.item_code,
            'item_type': d.item_type,
            'date': frm.doc.transaction_date,
            'purity': d.purity,
            'stock_uom': d.stock_uom
          },
          callback: function(r) {
            if (r.message){
              frappe.model.set_value(d.doctype, d.name, 'qty', r.message['qty']);
              frappe.model.set_value(d.doctype, d.name, 'making_charge_percentage', r.message['making_charge_percentage']);
              frappe.model.set_value(d.doctype, d.name, 'is_fixed_making_charge', r.message['making_charge']);
              frappe.model.set_value(d.doctype, d.name, 'board_rate', r.message['board_rate']);
              frappe.model.set_value(d.doctype, d.name, 'making_charge_based_on', r.message['making_charge_based_on']);
              frappe.model.set_value(d.doctype, d.name, 'making_charge_percentage', r.message['making_charge_percentage']);
              frappe.model.set_value(d.doctype, d.name, 'amount_with_out_making_charge', r.message['qty'] * r.message['board_rate']);
              if (r.message['making_charge']){
                frappe.model.set_value(d.doctype, d.name, 'making_charge', r.message['making_charge']);
              }
              else {
                //set making_charge if it's percentage
                frappe.model.set_value(d.doctype, d.name, 'making_charge', (d.amount_with_out_making_charge)*(d.making_charge_percentage * 0.01));
              }
              frappe.model.set_value(d.doctype, d.name, 'rate', (d.amount_with_out_making_charge + d.making_charge)/d.qty);
              frm.refresh_field('items');
            }
          }
        })
      }
    }
  },
  qty: function(frm, cdt, cdn){
    let d = locals[cdt][cdn];
    let total_gold_weight;
    if (d.qty){
      //set amount_with_out_making_charge while changing qty
      frappe.model.set_value(d.doctype, d.name, 'amount_with_out_making_charge', d.qty * d.board_rate);
      //set amount with rate * qty
      frappe.model.set_value(d.doctype, d.name, 'amount', d.qty * d.rate);
      frm.refresh_field('items');
      if(frm.doc.total_gold_weight){
        total_gold_weight = frm.doc.total_gold_weight
      }
      total_gold_weight = total_gold_weight + d.qty;
      frm.set_value('total_gold_weight', total_gold_weight);
    }
  },
  rate: function(frm, cdt, cdn){
    let d = locals[cdt][cdn];
    if (d.rate){
      //set amount with rate * qty
      frappe.model.set_value(d.doctype, d.name, 'amount', d.qty * d.rate);
      frm.refresh_field('items');
    }
  },
  amount: function(frm, cdt, cdn) {
    set_net_weight_and_amount(frm);
    set_totals(frm);
  },
  making_charge_percentage: function(frm, cdt, cdn){
    let d = locals[cdt][cdn];
    if (d.making_charge_percentage){
      var making_charge = d.amount_with_out_making_charge * d.making_charge_percentage * 0.01
      //set making_charge while changing of making_charge_percentage
      frappe.model.set_value(d.doctype, d.name, 'making_charge', making_charge);
    }
    frm.refresh_field('items')
  },
  amount_with_out_making_charge: function(frm, cdt, cdn){
    let d = locals[cdt][cdn];
    if (d.amount_with_out_making_charge){
      var making_charge = d.amount_with_out_making_charge * d.making_charge_percentage * 0.01
      frappe.model.set_value(d.doctype, d.name, 'making_charge', making_charge);//set making_charge while changing of amount_with_out_making_charge
    }
    frm.refresh_field('items')
  },
  making_charge:function (frm, cdt, cdn) {
    let d = locals[cdt][cdn];
    if(d.making_charge) {
      let rate = (d.amount_with_out_making_charge + d.making_charge)/d.qty
      if (rate)
      {
        //set rate by the change of making_charge
        frappe.model.set_value(d.doctype, d.name, 'rate', rate);
        frm.refresh_field('items');
      }
    }
  },
  amount_with_out_making_charge:function (frm, cdt, cdn) {
    let d = locals[cdt][cdn];
    if(d.amount_with_out_making_charge) {
      let rate = (d.amount_with_out_making_charge + d.making_charge)/d.qty
      if (rate)
      {
        //set rate by the change of amount_with_out_making_charge
        frappe.model.set_value(d.doctype, d.name, 'rate', rate);
        frm.refresh_field('items');
      }
    }
  },
  conversion_factor:function(frm, cdt,cdn){
    let d = locals[cdt][cdn];
    if(d.conversion_factor){
      var rate = d.board_rate * d.conversion_factor;
      //set rate by the change of conversion_factor
      frappe.model.set_value(d.doctype, d.name, 'rate', rate);
      frm.refresh_field('items');
    }
  },
  items_add: function(frm, cdt, cdn) {
    let child = locals[cdt][cdn]
    if(frm.doc.customer) {
      set_board_rate_read_only(frm, cdt, cdn);
    }
    if(frm.doc.delivery_date){
      frappe.model.set_value(child.doctype, child.name, 'delivery_date', frm.doc.delivery_date);
    }
    frm.refresh_field('items');
    set_totals(frm);
    set_net_weight_and_amount(frm);
  },
  items_remove: function(frm, cdt, cdn) {
    set_totals(frm);
    set_net_weight_and_amount(frm);
  }
})



let set_item_details = function(frm, child) {
  //function to get item get_item_details
  if(child.item_type){
    frappe.call({
        method : 'aumms.aumms.utils.get_board_rate',
        args: {
          item_type: child.item_type,
          date: cur_frm.doc.transaction_date,
          stock_uom: child.stock_uom,
          purity: child.purity
        },
        callback : function(r) {
          if (r.message) {
            frappe.model.set_value(child.doctype, child.name, 'board_rate', r.message)
            frappe.model.set_value(child.doctype, child.name, 'amount_with_out_making_charge', (child.qty * r.message))
            frappe.model.set_value(child.doctype, child.name, 'rate', (child.amount_with_out_making_charge + child.making_charge)/child.qty)
            frm.refresh_field('items');
          }
        }
    })
  }
}

let set_board_rate_read_only = function (frm, cdt, cdn) {
  //method for setting the customer type
  let child = locals[cdt][cdn]
    frappe.call({
        method : 'aumms.aumms.doc_events.sales_order.set_customer_type',
        args : {
          customer: frm.doc.customer
        },
        callback : function(r) {
          if (r.message) {
            child.customer_type = r.message
            frm.refresh_field('items');
          }
        }
    })
}

let set_filters = function(frm){
  frm.set_query('item_code', 'items', () => {
    return {
      filters: {
        disabled: 0
      }
    }
  });
  frm.set_query('stock_uom', 'items', () => {
    return {
      filters: {
        is_purity_uom: 1,
        enabled: 1
      }
    }
  });
  frm.set_query('item_code', 'old_jewellery_items', () => {
    return {
      filters: {
        disabled: 0,
        item_group: 'AuMMS Old Gold'
      }
    }
  });
}

let set_totals = function(frm){
  let total = 0;
  frm.doc.items.forEach((child) => {
    if(child.amount){
      total = total + child.amount;
    }
  });
  frm.set_value('grand_total', total);
  frm.set_value('rounded_total', total);
  frm.refresh_fields();
}

let set_net_weight_and_amount = function(frm){
  let total_old_gold_weight = 0;
  let total_gold_weight = 0;
  let total_old_gold_amount = 0;
  let total_gold_amount = 0;
  let balance_amount = 0;
  frm.doc.items.forEach((child) => {
    if(child.qty){
      total_gold_weight = total_gold_weight + child.qty;
    }
    if(child.amount){
      total_gold_amount = total_gold_amount + child.amount;
    }
  });
  if(frm.doc.aumms_exchange){
    frm.doc.old_jewellery_items.forEach((child) => {
      if(child.qty){
        total_old_gold_weight = total_old_gold_weight + child.qty;
      }
      if(child.amount){
        total_old_gold_amount = total_old_gold_amount + child.amount;
      }
    });
  }
  balance_amount = total_gold_amount - total_old_gold_amount
  frm.set_value('total_gold_weight', total_gold_weight);
  frm.set_value('total_gold_amount', total_gold_amount);
  frm.set_value('total_old_gold_weight', total_old_gold_weight);
  frm.set_value('total_old_gold_amount', total_old_gold_amount);
  frm.set_value('balance_amount', balance_amount);
  frm.refresh_fields();
}

let set_missing_delivery_dates = function(frm){
  frm.doc.items.forEach((child) => {
    if(!child.delivery_date){
      child.delivery_date = frm.doc.delivery_date;
    }
  });
  frm.refresh_fields('items');
}

let create_custom_buttons = function(frm){
  if(frm.doc.outstanding_amount != 0){
    frm.add_custom_button('Payment', () => {
      make_payment(frm);
    }, 'Create');
  }
  if (frm.doc.sales_order && !frm.doc.sales_invoice && frm.doc.purchase_order && !frm.doc.purchase_invoice) {
    frm.add_custom_button('Invoice', () => {
        // Invoice and Purchase Invoice creation methods

        // Create Sales Invoice
        frappe.call('aumms.aumms.doctype.jewellery_invoice.jewellery_invoice.create_sales_invoice', {
            source_name: frm.doc.sales_order,
            jewellery_invoice: frm.doc.name,
        }).then(r => {
            // After Sales Invoice is created, create the Purchase Invoice
            frappe.call('aumms.aumms.doctype.jewellery_invoice.jewellery_invoice.create_purchase_invoice', {
                source_name: frm.doc.purchase_order,
                jewellery_invoice: frm.doc.name,
            }).then(r => {
                // Reload the form after both invoices are created
                frm.reload_doc();
            });
        });
    }, 'Create');
}

  if(frm.doc.sales_invoice && !frm.doc.delivery_note){
    frm.add_custom_button('Delivery Note', () => {
      //Delivery Note creation method
      frappe.call('aumms.aumms.doctype.jewellery_invoice.jewellery_invoice.create_delivery_note', {
        source_name: frm.doc.sales_invoice,
        jewellery_invoice: frm.doc.name,
      }).then(r => {
        frm.reload_doc();
      });;
    }, 'Create');
  }
  if(frm.doc.sales_order && !frm.doc.sales_invoice && !frm.doc.delivery_note){
    frm.add_custom_button('Invoice and Delivery', () => {
      //Invoice and Deliver
      frappe.call('aumms.aumms.doctype.jewellery_invoice.jewellery_invoice.create_sales_invoice', {
        source_name: frm.doc.sales_order,
        jewellery_invoice: frm.doc.name,
        update_stock: 1,
      }).then(r => {
        frm.reload_doc();
      });;
    }, 'Create');
  }

  if(frm.doc.sales_order && !frm.doc.sales_invoice){
    frm.add_custom_button('Get Customer Advances', () => {
      //To get customer advances
      get_customer_advances(frm);
    });
  }
}

let make_payment = function(frm){
  let d = new frappe.ui.Dialog({
    title: 'Payment Entry',
    fields: [
      {
          label: 'Mode of Payment',
          fieldname: 'mode_of_payment',
          fieldtype: 'Link',
          options: 'Mode of Payment',
          reqd: 1
      },
      {
          label:"Cheque/Reference No",
          fieldname: 'reference_no',
          fieldtype: 'Data',
          mandatory_depends_on: 'eval:doc.mode_of_payment!==\'Cash\'',
          depends_on: 'eval:doc.mode_of_payment!==\'Cash\''
      },
      {
          label:"Cheque/Reference Date",
          fieldname: 'reference_date',
          fieldtype: 'Date',
          mandatory_depends_on: 'eval:doc.mode_of_payment!==\'Cash\'',
          depends_on: 'eval:doc.mode_of_payment!==\'Cash\''
      },
      {
        label: 'Posting Date',
        fieldname: 'posting_date',
        fieldtype: 'Date'
      },
      {
        label: 'Payment Amount',
        fieldname: 'amount',
        fieldtype: 'Currency',
        default: frm.doc.outstanding_amount,
        reqd: 1
      },
      {
        label: 'Balance Amount',
        fieldname: 'balance',
        fieldtype: 'Currency',
        default: frm.doc.outstanding_amount,
        read_only: 1
      }
    ],
    primary_action_label: 'Submit',
    primary_action(values) {//Create Payment Entry
      if (values.amount) {
        if (parseFloat(values.amount) <= parseFloat(frm.doc.outstanding_amount)) {
          frappe.call({
            method: 'aumms.aumms.doctype.jewellery_invoice.jewellery_invoice.create_payment_entry',
            args: {
              'mode_of_payment':values.mode_of_payment,
              'amount': values.amount,
              'docname': frm.doc.name,
              'reference_no': values.reference_no,
              'reference_date': values.reference_date,
              'posting_date': values.posting_date
            },
            btn: $('.primary-action'),
            freeze: true,
            callback: function(r) {
              if (r.message){
                frm.reload_doc()
              }
            }
          })
        } else {
          frappe.throw(__('Amount of payment cannot exceed total amount'))
        }
      }
      d.hide();
    }
  });
  d.show();
}

let remove_previous_links = function(frm){
  if(frm.is_new()){
    frm.set_value('sales_order', );
    frm.set_value('sales_invoice', );
    frm.set_value('delivery_note', );
    frm.set_value('purchase_receipt', );
    frm.refresh_fields();
  }
}

let get_customer_advances= function(frm){
  frm.doc.items.forEach((child) => {
    frappe.call('aumms.aumms.utils.get_advances_payments_against_so_in_gold', {
      sales_order: frm.doc.sales_order,
      item_type: child.item_type,
      purity: child.purity,
      stock_uom: child.stock_uom
    }).then(r => {
      if(r.message){
        frm.clear_table('customer_advances');
        let total_advance_received = 0;
        let total_qty_obtained = 0;
        let purity = '';
        let uom = '';
        r.message.forEach((advance) => {
          frm.add_child('customer_advances', {
            'reference': advance.payment_entry,
            'posting_date': advance.posting_date,
            'item_type': advance.item_type,
            'purity': advance.purity,
            'amount': advance.amount,
            'board_rate': advance.board_rate,
            'stock_uom': advance.stock_uom,
            'qty_obtained': advance.qty_obtained
          });
          purity = advance.purity;
          uom = advance.stock_uom;
          total_advance_received = total_advance_received + (advance.amount);
          total_qty_obtained = total_qty_obtained + (advance.qty_obtained);
        });
        frm.set_value('total_advance_received', total_advance_received);
        frm.set_value('total_qty_obtained', total_qty_obtained);
        frm.set_value('uom', uom);
        frm.set_value('purity', purity);
        frm.save_or_update();
      }
    });
  });
}
