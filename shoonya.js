
shoonya_api = window.shoonya_api || {};

shoonya_api = function () {
    let alert_msg_disappear_after = 3000; // Unit milliseconds

    //TODO - Remove these hardcoded values
    let vix_tk = '26017', nifty_tk = '26000', bank_nifty_tk = '26009', fin_nifty_tk = '26037'
    let user_id = '', session_token='', ws = '';

    let subscribed_symbols = ["NSE|26017", "NSE|26000", "NSE|26009", "NSE|26037"];
    let pending_to_subscribe_tokens = new Set();
    let logged_in = false;
    let live_data = {};
    let heartbeat_timeout = 7000;

    const url = {
        websocket : "wss://trade.shoonya.com/NorenWSWeb/",
        search_instrument : "https://trade.shoonya.com/NorenWClientWeb/SearchScrip",
        order_book : "https://trade.shoonya.com/NorenWClientWeb/OrderBook",
        place_order : "https://trade.shoonya.com/NorenWClientWeb/PlaceOrder",
        modify_order : "https://trade.shoonya.com/NorenWClientWeb/ModifyOrder",
        cancel_order : "https://trade.shoonya.com/NorenWClientWeb/CancelOrder",
        exit_order : "https://trade.shoonya.com/NorenWClientWeb/ExitOrder",
        positions : "https://trade.shoonya.com/NorenWClientWeb/PositionBook",
    }

    function update_ltps(instr_token, ltp) {
        switch (instr_token) {
            case vix_tk:
                $('#vix').html(ltp)
                break;
            case nifty_tk:
                $('#nifty').html(ltp)
                break;
            case bank_nifty_tk:
                $('#bank_nifty').html(ltp)
                break;
            case fin_nifty_tk:
                $('#fin_nifty').html(ltp)
                break;
            default:
                update_ltp('#watch_list_body .watch_' + instr_token);   //In watch list
                update_ltp("#open_orders .open_order_" + instr_token)  // In Open Order table
                update_ltp("#active_trades_table .trade_" + instr_token)  // In Active Trades table
                update_ltp("#active_paper_trades .trade_" + instr_token)  // In Active Trades table
                break;
        }
    }

    function update_ltp(selector) {
        $(selector).each(function(i, ltp_elm) {
            $(ltp_elm).text(result.lp)

            if(selector.startsWith('#active_trade') || selector.startsWith("#active_paper_trade")) {
                $(ltp_elm).text(result.lp)
                let tr_elm = $(ltp_elm).parent();
                if(tr_elm.attr('trade') == 'active') {
                    trade.update_pnl(tr_elm)
                    trade.update_total_pnl()
                }
            } else if(selector.startsWith('#watch_list')) {
                let margin = parseInt($(ltp_elm).attr('lot_size')) * result.lp
                if(!isNaN(margin))
                    $(ltp_elm).parent().find('.margin_req').text(margin.toFixed(0))
            }
        });
    }

    function connect() {
        ws = new WebSocket(url.websocket);
        ws.onopen = function (event) {
            let data = {
                "t": "c",
                "uid": user_id,
                "actid": user_id,
                "susertoken": session_token,
                "source": "WEB"
            };
            console.log("Socket opened")
            ws.send(JSON.stringify(data));
            $('#connection_status').css('color', 'green')
            console.log("Session data sent")

            setInterval(function () {
                var _hb_req = '{"t":"h"}';
                ws.send(_hb_req);
            }, heartbeat_timeout);
        };

        ws.onmessage = function (event) {
            result = JSON.parse(event.data)
            if(result.t == 'ck') {
                 // trigger("open", [result]);
                if (result.s == 'OK') {
                    console.log('Login successful')
                    logged_in = true;
                    subscribed_symbols.forEach(subscribe_token)
                }
            }
            if( result.t == 'tk' || result.t == 'tf') {
                if(result.lp != undefined) {
                    let instr_token = result.tk
                    let ltpf = parseFloat(result.lp).toFixed(2)
                    live_data[instr_token] = ltpf
                    update_ltps(instr_token, ltpf)
                }
            }
            if( result.t == 'dk' || result.t == 'df') {
                console.log("..................  Another quote ...................")
                // trigger("quote", [result]);
            }
            if(result.t == 'om') {
                // console.log("..................  OM ...................")
                // console.log(result)
            }
        }

        ws.onclose = function (event) {
            $('#connection_status').css('color', 'red')
            console.log('WebSocket is closed. Reconnect will be attempted in 1 second.', event.reason);
            setTimeout(function () {
                connect();
            }, 1000);
        };

        ws.onerror = function (event) {
            console.error("WebSocket error: ", event);
        };
    }

    function subscribe_token(token) {
        // if (!subscribed_symbols.includes(token)) {  // Subscribe only if not subscribed earlier
            pending_to_subscribe_tokens.add(token);
        // }
        for(token of pending_to_subscribe_tokens.keys()) {
            let symtoken = {"t": "t", "k": token.concat('#')}
            // console.log(symtoken)
            if (ws.readyState != WebSocket.OPEN || !logged_in) {
                console.log("Web socket not ready yet..")
                setTimeout(function () {
                    subscribe_token(token)
                }, 100)
            } else {
                console.log("Web socket is ready.. Subscribing ", token)
                ws.send(JSON.stringify(symtoken));
                if(!subscribed_symbols.includes(token))
                    subscribed_symbols.push(token);
                pending_to_subscribe_tokens.delete(token);
            }
        }
    }

    function get_payload(params) {
        let payload = 'jData=' + JSON.stringify(params);
        payload = payload + "&jKey=" + session_token;
        return payload
    }

    function post_request(url, params, success_cb, failure_cb) {
        let payload = get_payload(params)
        $.ajax({
            url: url,
            type: "POST",
            dataType: "json",
            data: payload,
            success: function (data, textStatus, jqXHR) {
                console.log(url + " : params = ", JSON.stringify(params))
                console.log("Post request success: Resp = ", JSON.stringify(data))
                if (success_cb != undefined) {
                    success_cb(data)
                }
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.error("Ajax failed")
                console.error(errorThrown)
                console.error(jqXHR)
                console.error(textStatus)
                if (failure_cb != undefined) {
                    failure_cb(jqXHR, textStatus, errorThrown)
                }
            }
        });
    }

    let search_instrument = function(stext) {
        let params = {"uid": user_id, "stext": stext}
        post_request(url.search_instrument, params);
    }

    /* Search instrument autocomplete */
    $( "input.search-instrument" ).autocomplete({
            minLength: 2,
            autoFocus: true,
            appendTo: '#instr-drop-down',
            source:  function(request, response){
                        params = {"uid": user_id, "stext": request.term}
                        $.ajax({
                            url: url.search_instrument,
                            type: "POST",
                            dataType: "json",
                            data: get_payload(params),
                            success: function (data, textStatus, jqXHR) {
                                // console.log("Ajax success")
                                response($.map(data.values, function (item) {
                                    item.dname = watch_list.fin_nifty_dname_fix(item.tsym, item.dname)
                                    let dname = item.dname != undefined? item.dname : item.tsym;
                                    return {
                                        label: dname,
                                        value: dname,
                                        tsym: item.tsym,
                                        dname: dname,
                                        lot_size: item.ls,
                                        exch: item.exch,
                                        token: item.token,
                                        optt :  item.optt
                                    };
                                }));
                            },
                            error: function (jqXHR, textStatus, errorThrown) {
                                console.log("Ajax error")
                                show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                            },
                        })},

            select: function (event, ui) {
                // when item is selected
                $(this).val(ui.item.value);
                $(this).attr('lot_size', ui.item.lot_size)
                $(this).attr('exch', ui.item.exch)
                $(this).attr('token', ui.item.token)
                $(this).attr('tsym', ui.item.tsym)
                $(this).attr('dname', ui.item.dname)
                $(this).attr('optt', ui.item.optt)
                console.log("Selected item : ", ui.item)
            },

            create: function () {
                $(this).data('ui-autocomplete')._renderItem = function (ul, item) {
                    return $('<li class="dropdown-item">')
                        .append(item.label)
                        .append('</li>')
                        .appendTo(ul); // customize your HTML
                };
            }
    });

    function show_success_msg(msg) {
        $('#order_success_msg').html("<strong>" + msg + "</strong>");
        $('#order_success_alert').show();
        setTimeout(function(){
            // $('#order_success_msg').html("");
            $('#order_success_alert').hide()}, alert_msg_disappear_after);
    }

    function show_error_msg(msg, auto_hide=true) {
        $('#order_error_msg').html("<strong>" + msg + "</strong>");
        $('#order_error_alert').show();
        if(auto_hide)
            setTimeout(function(){
                // $('#order_error_msg').html("");
                $('#order_error_alert').hide()}, alert_msg_disappear_after);
    }

    const ACTION = Object.freeze({
        place_order: "place_order",
        modify: "modify",
        exit: "exit",
        open_order: "open_order",
    });

    class OpenOrderManager{
        constructor() {
            this.open_orders = {}
        }

        add_action(order_id, action) {
            if (this.open_orders[order_id] == undefined) {  //Create new
                this.open_orders[order_id] = [];
                this.open_orders[order_id].push(action);
            } else {
                if(!this.open_orders[order_id].includes(action))
                    this.open_orders[order_id].push(action)
            }
        }

        add_open_order(order_id) {
            if (this.open_orders[order_id] == undefined){  //Add open order only if there is no other action present
                console.log("!!! Add open order : ", order_id)
                this.add_action(order_id, ACTION.open_order)
            }
        }

        add_place_order(order_id) {
            console.log("!!! Add place order : ", order_id)
            this.add_action(order_id, ACTION.place_order)
        }

        add_exit(order_id) {
            console.log("!!! Add exit : ", order_id)
            this.add_action(order_id, ACTION.exit)
        }

        add_modify(order_id) { //Returns if monitored already or not
            console.log("!!! Add modify : ", order_id)
            if(this.open_orders[order_id].includes(ACTION.modify))  // Already first modify is monitoring it
                return true
            else
                this.add_action(order_id, ACTION.modify)
                return false
        }

        exec_permission(order_id, action) {
            if( this.open_orders[order_id] == undefined ) {
                console.error("Order id not found in open order manager " + order_id)
                return false;
            }
            switch(action) {
                case ACTION.exit:
                    return true;
                    break;
                case ACTION.modify:
                    if(this.open_orders[order_id].includes(ACTION.open_order)) {
                        return false;
                    } else if(this.open_orders[order_id].includes(ACTION.exit)) {
                        return false;
                    } else return true;
                    break;
                case ACTION.place_order :
                    if(this.open_orders[order_id].includes(ACTION.modify)) {
                        return false;
                    } else return true;
                    break;
                case ACTION.open_order :
                    return true;
                    break;
                default:
                    console.error("Unknown action " + action + " encountered in open order manager : " + order_id)
                    return false;
                    break;
            }
        }

        is_monitored(order_id) {
            return this.open_orders[order_id] != undefined
        }

        remove_order_id(order_id) {
            delete this.open_orders[order_id]
        }
    }

    const open_order_mgr = new OpenOrderManager();
    let unique_row_id = 0;

    const orderbook = {

        buy : function(buy_btn) {
            let tr_elm = $(buy_btn).parent().parent();
            orderbook.place_buy_sell_order(tr_elm, 'B')
        },

        sell : function(sell_btn) {
            let tr_elm = $(sell_btn).parent().parent();
            orderbook.place_buy_sell_order(tr_elm, 'S')
        },

        buy_selected : function() {
            $('#watch_list_body input:checkbox:checked').each(function(){
                let row_elm = $(this).parent().parent()
                row_elm.find('.buy').click()
            })
        },

        sell_selected : function() {
            $('#watch_list_body input:checkbox:checked').each(function(){
                let row_elm = $(this).parent().parent()
                row_elm.find('.sell').click()
            })
        },

        display_order_exec_msg: function(order) {
            switch (order.status) {
                case "OPEN" :
                    show_success_msg("Order is open. Order number: " + order.norenordno + "  Symbol: " + order.tsym + " Qty: " + order.qty);
                    break;
                case "COMPLETE" :
                    show_success_msg("Order completed. Order number: " + order.norenordno + "  Symbol: " + order.tsym + " Qty: " + order.qty);
                    break;
                case "REJECTED" :
                    show_error_msg("Order " + order.norenordno + " rejected. Reason : " + order.rejreason  + "   Symbol: " + order.tsym + " Qty: " + order.qty, false );
                    break;
                case "CANCELED":
                    show_success_msg("Order " + order.norenordno + " cancelled. Symbol: " + order.tsym + " Qty: " + order.qty );
                    break;
                default:
                    console.log('Default order status : ')
                    console.log(JSON.stringify(order))
                    break;
            }
        },

        get_orderbook : function(success_cb) {
            let values          = {};
            values["uid"]       = user_id ;
            let payload = get_payload(values)
            $.ajax({
                url: url.order_book,
                type: "POST",
                dataType: "json",
                data: payload,
                success: function (data, textStatus, jqXHR) {
                    success_cb(data)
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Ajax error")
                    show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                }
            });
        },

        update_open_order_list : function(orders) {
            $('#open_order_list').html('')
            if(orders!=undefined)
                orders.forEach(function(order) {
                    orderbook.add_open_order(order)
                })
        },

        add_open_order : function(order) {
            if (order.status == "OPEN") {

                let token = order.exch + "|" + order.token
                subscribe_token(token)

                let type = order.amo == "Yes"? "AMO ": "";
                let buy_sell = '';
                if (order.trantype == "B") {
                    buy_sell = '<span class="badge badge-success">' + type + 'Buy</span>'
                } else {
                    buy_sell = '<span class="badge badge-danger">' + type + 'Sell</span>'
                }
                let ttype = orderbook.know_bull_or_bear(order)

                let dname = (order.dname != undefined)? order.dname : order.tsym;
                ++unique_row_id;
                let row_id = "row_id_" + unique_row_id;
                $('#open_order_list').append(`<tr id="${row_id}" ordid="${order.norenordno}" exch="${order.exch}" tsym="${order.tsym}" 
                                    qty="${order.qty}" token="${order.token}" ttype="${ttype}" trtype="${order.trantype}"">
                        <td>${buy_sell}</td>
                        <td class="order-num">${order.norenordno}</td>
                        <td>${dname}</td>
                        <th class="open_order_${order.token} ltp"></th>
                        <td><input type="text" class="form-control entry" placeholder=""  value="${order.prc}"></td>
                        <td><input type="text" class="form-control target" placeholder=""  value=""></td>
                        <td><input type="text" class="form-control sl" placeholder=""  value=""></td>
                        <td><input type="text" class="form-control qty" placeholder=""  value="${order.qty}"></td>
    
                        <td><button type="button" class="btn btn-success modify" onclick="shoonya_api.orderbook.modify_order(this)">Modify</button></td>
                        <td><button type="button" class="btn btn-danger cancel" onclick="shoonya_api.orderbook.cancel_order(this)">Cancel</button></td>
                </tr>`);

                let order_id = order.norenordno
                if(!open_order_mgr.is_monitored(order_id)) {
                    open_order_mgr.add_open_order(order_id)
                    orderbook.get_order_status(order_id, ACTION.open_order, (function(row_id){
                        return function(matching_order, orders){

                        let tr_elm = $('#' + row_id);
                        console.log("Row id : " + row_id + " ")
                        let trade_pos = trade.getCounterTradePosition(tr_elm);
                        if(trade_pos.length > 0) {
                            //Close the position
                            orderbook.exit_order_cb(matching_order, orders, trade_pos)
                        } else {
                            //Add new trade
                            orderbook.place_order_default_cb(matching_order, orders, row_id)
                        }
                        tr_elm.remove();
                    }})(row_id)
                    )
                }
            }
        },

        place_buy_sell_order : function(tr_elm, buy_sell, success_cb) {
            tr_elm.find('.buy').attr('disabled', 'disabled');
            tr_elm.find('.sell').attr('disabled', 'disabled');

            let entry_elm = tr_elm.find('.entry')
            let entry_val = entry_elm.val()
            entry_elm.val('') //Reset once used

            console.log("Inside place order : " + entry_val)
            if(entry_val == undefined) entry_val = 0.0;
            let entry_obj = milestone_manager.get_value_object(entry_val);
            let qty = tr_elm.find('.qty').val()

            let params = this.get_order_params(tr_elm, buy_sell, entry_obj, qty)
            if (entry_obj.spot_based) {
                params.dname = tr_elm.attr('dname')
                this.add_to_spot_order_list(params, entry_val)
            } else {
                console.log("Going to place order " + JSON.stringify(params))
                if(!is_paper_trade()) {
                    post_request(url.place_order, params, function (data) {
                        if (success_cb != undefined) {  // Call custom function provided.. In case of exit, it needs to remove tr
                            console.log("Success call back is provided. Will be called")
                            success_cb(data)
                        } else { // No custom function provided. Default actions
                            console.log("Default place order call back called")
                            orderbook.place_order_cb_carry_target_sl_to_active_trade(data)
                        }
                    })
                } else {
                    let ltp = tr_elm.find('.ltp').text()
                    if(!isNaN(parseFloat(ltp)))
                        orderbook.place_paper_trade(params, ltp)
                    else
                        show_error_msg("LTP is missing")
                }
            }

            setTimeout(function() {
                    tr_elm.find('.buy').removeAttr('disabled');
                    tr_elm.find('.sell').removeAttr('disabled');
            }, 500)
        },

        add_to_spot_order_list : function(item, entry_val) {
            let buy_sell = '';
            if (item.trantype === "B") {
                buy_sell = '<span class="badge badge-success">Buy</span>'
            } else {
                buy_sell = '<span class="badge badge-danger">Sell</span>'
            }

            let ttype = this.know_bull_or_bear(item)

            let dname = (item.dname != undefined)? item.dname : item.tsym;
            let row_id = `row_id_${++unique_row_id}`
            $('#spot_order_list').append(`<tr id="${row_id}" ordid="${item.norenordno}" exch="${item.exch}" tsym="${item.tsym}" qty="${item.qty}" token="${item.token}" ttype="${ttype}" trtype="${item.trantype}">
                    <td>${buy_sell}</td>
                    <td class="order-num">Spot Based Entry</td>
                    <td>${dname}</td>
                    <th class="open_order_${item.token} ltp"></th>
                    <td><input type="text" class="form-control entry" placeholder=""  value="${entry_val}"></td>
                    <td><input type="text" class="form-control target" placeholder=""  value=""></td>
                    <td><input type="text" class="form-control sl" placeholder=""  value=""></td>
                    <td><input type="text" class="form-control qty" placeholder=""  value="${item.qty}"></td>

                    <td><button type="button" class="btn btn-success modify" onclick="shoonya_api.orderbook.modify_order(this)">Modify</button></td>
                    <td><button type="button" class="btn btn-danger cancel" onclick="shoonya_api.orderbook.cancel_order(this)">Cancel</button></td>
            </tr>`);

            let entry_obj = milestone_manager.get_value_object(entry_val)
            if(entry_obj.spot_based)
                milestone_manager.add_entry(row_id, item.token, ttype, item.trantype, entry_obj);
        },

        update_open_orders : function() {
            hide_other_tabs('#open_orders')
            orderbook.get_orderbook(function(data) {orderbook.update_open_order_list(data);})
        },

        get_order_params: function(elm, buy_or_sell, entry, qty) {

            let prctyp = 'LMT', price = "0.0";
            let remarks = "";
            let tsym = elm.attr('tsym');
            let dname = elm.attr('dname');
            let token = elm.attr('token');
            if(entry.value == '') {
                prctyp = 'MKT'
            }
            else
                price = entry.value.toString()
            let exch = elm.attr('exch');
            /* "C" For CNC, "M" FOR NRML, "I" FOR MIS, "B" FOR BRACKET ORDER, "H" FOR COVER ORDER*/
            if(exch == "NSE" || exch == "BSE") {
                prd = "I";
            } else {
                prd = "M";
                if( tsym != undefined) {
                    if (tsym.startsWith("NIFTY"))
                        remarks = "N-" + Math.round(live_data[nifty_tk])
                    else if (tsym.startsWith("BANKNIFTY"))
                        remarks = "B-" + Math.round(live_data[bank_nifty_tk])
                    else if (tsym.startsWith("FINNIFTY"))
                        remarks = "F-" + Math.round(live_data[fin_nifty_tk])
                    remarks += " Vix " + live_data[vix_tk]
                }
            }

            let values          =  {'ordersource':'WEB'};
            values["uid"]       = user_id;
            values["actid"]     = user_id;
            values["trantype"]  = buy_or_sell;
            values["prd"]       = prd;
            values["exch"]      = exch;
            values["tsym"]      = tsym;
            values["dname"]      = dname;
            values["token"]      = token;
            values["qty"]       = qty;
            values["dscqty"]    = qty;
            values["prctyp"]    = prctyp       /*  LMT / MKT / SL-LMT / SL-MKT / DS / 2L / 3L */
            values["prc"]       = price;
            values["ret"]       = 'DAY';
            values["remarks"]   = remarks;

            // values["amo"] = "Yes";          // TODO - AMO ORDER

            return values;
        },

        cancel_order : function(td_elm) {
            let tr_elm = $(td_elm).parent().parent();
            let orderno = tr_elm.find('.order-num').html()
            let row_id = tr_elm.attr('id')

            if(orderno.includes('Spot')) {  // Spot based entry
                milestone_manager.remove_milestone(row_id);
                tr_elm.remove();
            } else {

                let values            = {'ordersource':'WEB'};
                values["uid"]         = user_id;
                values["norenordno"]  = orderno;

                post_request(url.cancel_order, values, function (data) {
                    if (data.stat.toUpperCase() === "OK")
                        tr_elm.remove();

                    if ( data.result != undefined) {
                        let orderno = data.result;  //For cancel order, order-id is contained in result variable

                        orderbook.get_orderbook(function(orders) {
                            let matching_order = orders.find(order => order.norenordno === orderno)
                            if (matching_order != undefined) {
                                orderbook.display_order_exec_msg(matching_order);
                            }
                            orderbook.update_open_order_list(orders);
                        })
                    }
                });
            }
        },

        modify_order : function(td_elm) {
            let tr_elm = $(td_elm).parent().parent();
            tr_elm.find('.modify').attr('disabled', 'disabled');

            let order_id = tr_elm.find('.order-num').html()
            let entry_value = tr_elm.find('.entry').val()
            let row_id = tr_elm.attr('id')
            let ttype = tr_elm.attr('ttype')
            let trtype = tr_elm.attr('trtype')
            let token = tr_elm.attr('token')

            let target_value = tr_elm.find('.target').val()

            if(target_value == undefined || target_value == '') {
                milestone_manager.remove_target(row_id);
            } else { // Target has some value
                let target_obj = milestone_manager.get_value_object(target_value)
                milestone_manager.add_target(row_id, token, ttype, trtype, target_obj);
            }

            let sl_value = tr_elm.find('.sl').val()

            if(sl_value == undefined || sl_value == '') {
                milestone_manager.remove_sl(row_id);
            } else {  // SL has some value
                let sl_obj = milestone_manager.get_value_object(sl_value)
                milestone_manager.add_sl(row_id, token, ttype, trtype, sl_obj);
            }

            let entry_obj = milestone_manager.get_value_object(entry_value)
            if(entry_obj.spot_based && entry_obj.value != '') {  // Spot based entry
                milestone_manager.add_entry(row_id, token, ttype, trtype, entry_obj)
            } else {
                milestone_manager.remove_entry(row_id); // Entry should be present in milestone_mgr only if it is spot based. Else LIMIT & MKT order should be placed immediately
                let prctyp = 'LMT', price = "0.0";
                if (entry_obj.value == '') {
                    prctyp = 'MKT'
                } else price = entry_obj.value;

                let qty = tr_elm.find('.qty').val()

                let values = {'ordersource': 'WEB'};
                values["uid"] = user_id;
                values["actid"] = user_id;
                values["exch"] = tr_elm.attr('exch');
                values["tsym"] = tr_elm.attr('tsym');
                values["qty"] = qty;
                values["prctyp"] = prctyp;
                values["prc"] = price;

                if(!order_id.includes("Spot")) {  // Modify value order.. Not spot based order
                    values["norenordno"] = order_id;
                    post_request(url.modify_order, values, function(data) {
                        if(data.stat == "Ok") {
                                let orderno = data.result;  // In case of modify and cancel order 'result' contains order ID.
                                let monitored = open_order_mgr.add_modify(orderno)

                                if(!monitored) {
                                    orderbook.get_order_status(order_id, ACTION.modify, (function (row_id) {
                                        return function (matching_order, orders) {
                                            let order_id = matching_order.norenordno;
                                            console.log("Modified Order status = completed.. " + order_id + " row_id = " + row_id)
                                            console.log(open_order_mgr.open_orders[order_id])
                                            /*if (row_id == undefined)
                                                row_id = orderbook.get_row_id_by_order_id(order_id);*/

                                            milestone_manager.add_order_id(row_id, order_id);

                                            matching_order.prc = matching_order.avgprc; // When order status is COMPLETE avgprc field contains the correct price
                                            const ms_obj = milestone_manager.get_milestone(order_id);
                                            let target = '';
                                            let sl = '';
                                            if (ms_obj != undefined) {
                                                const old_row_id = ms_obj.row_id;
                                                target = milestone_manager.get_value_string(ms_obj.milestone.target)
                                                sl = milestone_manager.get_value_string(ms_obj.milestone.sl)
                                                milestone_manager.remove_milestone(old_row_id); //Target and SL have been taken into Active Trade Row
                                            }
                                            trade.display_active_trade(matching_order, target, sl);
                                            orderbook.update_open_order_list(orders);
                                        }
                                    })(row_id));
                                }
                        }
                        else show_error_msg(data.emsg)
                    });
                } else { // Place fresh order as spot entry value has been removed as orderno contains "Spot based entry"
                    orderbook.place_buy_sell_order(tr_elm, tr_elm.attr('trtype'), function(data) {
                        orderbook.place_order_cb_carry_target_sl_to_active_trade(data, row_id)
                    });
                    tr_elm.remove()
                }
            }

            setTimeout(function() {
                tr_elm.find('.modify').removeAttr('disabled');
            }, 1000)
        },

        get_row_id_by_order_id : function(order_id) {
            let tr_elm = $(`#open_order_list tr[ordid=${order_id}]`)
            return tr_elm.attr('id');
        },

        place_order_cb_carry_target_sl_to_active_trade : function (data, row_id) {
            if(data.stat.toUpperCase() === "OK") {
                console.log("place_order_cb_carry_target_sl_to_active_trade row_id : " + row_id )
                orderbook.update_open_orders();
                let order_id = data.norenordno;

                open_order_mgr.add_place_order(data.norenordno)

                orderbook.get_order_status(order_id, ACTION.place_order, (function(row_id){
                    return function(matching_order, orders){
                        orderbook.place_order_default_cb(matching_order, orders, row_id)
                    }
                })(row_id));
            } else
                show_error_msg(data.emsg);
        },

        place_order_default_cb : function(matching_order, orders, row_id) {

            let  order_id = matching_order.norenordno
            console.log("Place Order completed.. " + order_id)
            console.log(open_order_mgr.open_orders[order_id])
            if (row_id == undefined)
                row_id = orderbook.get_row_id_by_order_id(order_id);

            milestone_manager.add_order_id(row_id, order_id);

            matching_order.prc = matching_order.avgprc; // When order status is COMPLETE avgprc field contains the correct price
            const ms_obj = milestone_manager.get_milestone(order_id);
            let target = '';
            let sl = '';
            if (ms_obj != undefined) {
                const old_row_id = ms_obj.row_id;
                target = milestone_manager.get_value_string(ms_obj.milestone.target)
                sl = milestone_manager.get_value_string(ms_obj.milestone.sl)
                milestone_manager.remove_milestone(old_row_id); //Target and SL have been taken into Active Trade Row
            }
            console.log("Adding active trade row now for " + order_id)
            trade.display_active_trade(matching_order, target, sl);
            orderbook.update_open_order_list(orders);
        },

        place_paper_trade : function(order, ltp) {

            let order_id = "paper" + Date.now()
            order.norenordno = order_id
            order.prc = ltp
            order.norentm = new Date().toLocaleTimeString()

            ++unique_row_id;
            let row_id = "row_id_" + unique_row_id;
            milestone_manager.add_order_id(row_id, order_id);

            let target = '';
            let sl = '';
            trade.display_active_trade(order, target, sl, true);
        },

        //TODO - Partial quantity exit should be done
        exit_order : function(td_elm) {
            let tr_elm = $(td_elm).parent().parent();
            let to_be_closed_order_id = tr_elm.attr('ordid')
            let exit_lim = tr_elm.find('.exit-limit')
            let limit_value = exit_lim.val(); exit_lim.val('')
            let qty = tr_elm.find('.qty').val()

            let buy_sell= tr_elm.attr('trtype') == 'B' ? 'S' : 'B'; // Do the opposite
            let exit_limit = milestone_manager.get_value_object(limit_value);
            let values = orderbook.get_order_params(tr_elm, buy_sell, exit_limit, qty)

            if(!is_paper_trade()) {
                post_request(url.place_order, values, function (data) {
                    if (data.stat.toUpperCase() === "OK") {
                        let orderno = data.norenordno;
                        orderbook.update_open_orders();

                        open_order_mgr.add_exit(orderno)

                        orderbook.get_order_status(orderno, ACTION.exit, (function (tr_elm) {
                            return function (matching_order, orders) {
                                orderbook.exit_order_cb(matching_order, orders, tr_elm);
                                open_order_mgr.remove_order_id(orderno)
                            }
                        })(tr_elm))
                    } else
                        show_error_msg(data.emsg);
                });
            } else {
                values.avgprc = tr_elm.find('.ltp').text()
                values.norentm = new Date().toLocaleTimeString()
                orderbook.exit_order_cb(values, null, tr_elm);
            }
        },

        exit_order_cb: function(matching_order, orders, tr_elm){
            console.log("Exit order complete cb : "+ matching_order.norenordno)
            console.log(open_order_mgr.open_orders[matching_order.norenordno])

            milestone_manager.remove_milestone(tr_elm.attr('id'));
            tr_elm.addClass('table-secondary');
            tr_elm.attr('trade', 'closed');
            let td_elm = tr_elm.find('.exit-limit').parent();
            td_elm.html(`<span class="badge badge-pill badge-dark">${matching_order.norentm.split(" ")[0]}</span>
                                    <span class="badge badge-info">${matching_order.remarks}</span>
                                    </br><span class="price exit-price">${matching_order.avgprc}</span></br>
                                `);
            trade.update_pnl(tr_elm, matching_order.avgprc)
            trade.update_total_pnl()

            tr_elm.find('.modify').parent().html(`CLOSED</br><span class="badge badge-pill badge-secondary" title="Watch live" onclick="shoonya_api.trade.toggle_watch_closed_trade($(this))" style="cursor:pointer;padding:8px;margin-top:10px">Watch</span>`);
            tr_elm.find('.exit').parent().html(`<button type="button" class="btn btn-dark btn-sm" onclick="$(this).parent().parent().remove();shoonya_api.trade.reset_max_profit_loss()">Delete</button>`);
            tr_elm.find('.qty').attr('disabled', 'disabled');
            tr_elm.find('.exit').attr('disabled', 'disabled');

            if(orders) { // In case of paper trade, orders will be null and the below code will not execute
                orderbook.update_open_order_list(orders);
            }

            //Remove SL and Target set on Total row, if there are no active trades
            let table_id = is_paper_trade()? "#active_paper_trades" : "active_trades_table"
            if($(`${table_id} tr[trade="active"]`).length < 1) {
                milestone_manager.remove_milestone("total_row");
                $('#total_row th input.target, #total_row th input.sl').val("")  //Reset UI
            }
        },

        get_order_status(orderno, action, oncomplete_cb) {

            if(open_order_mgr.exec_permission(orderno, action)) {
                console.log(action + ": get_order_status : " + orderno + " Making get_orderbook post req")
                orderbook.get_orderbook(function (orders) {
                    let matching_order = orders.find(order => order.norenordno === orderno)
                    if (matching_order != undefined) {
                        console.log(orderno + " : Found matching order ")
                        switch (matching_order.status) {
                            case "OPEN":
                                setTimeout(function () {
                                    orderbook.get_order_status(orderno, action, oncomplete_cb);
                                }, 2000)
                                break;
                            case "COMPLETE": // TODO - AMO ORDER CHANGE TO COMPLETE
                                console.log("Calling " + action + " on complete cb")
                                oncomplete_cb(matching_order, orders);
                                setTimeout(function(){
                                    console.log("Playing sound now..")
                                    document.getElementById('notify3').play()
                                }, 10);
                                break;
                            case "REJECTED":
                                orderbook.display_order_exec_msg(matching_order);
                                setTimeout(function(){
                                    console.log("Playing sound now..")
                                    document.getElementById('notify1').play()
                                }, 10);
                                break;
                            default:
                                orderbook.display_order_exec_msg(matching_order);
                        }
                    }
                })
            }

        },

        show_orderbook : function() {
            $('#order_book_table').html("")
            hide_other_tabs('#order_book')
            this.get_orderbook(function(orders) {
                if(orders!=undefined)
                    orders.forEach((order)=> orderbook.show_order(order))
            })
        },

        get_prod_name : function(prd_code) {
            let prd = "";
            switch (prd_code) {
                case "M" : prd = "NRML"; break;
                case "I" : prd = "MIS"; break;
                case "C" : prd = "CNC"; break;
                case "B" : prd = "Bracket Order"; break;
                case "H" : prd = "Cover Order"; break;
                default: prd = prd_code; break;
            }
            return prd;
        },

        show_order : function(item) {
                let type = item.amo == "Yes"? "AMO ": "";
                let buy_sell = '';
                if (item.trantype == "B") {
                    buy_sell = '<span class="badge badge-success">' + type + 'Buy</span>'
                } else {
                    buy_sell = '<span class="badge badge-danger">' + type + 'Sell</span>'
                }
                let prd = this.get_prod_name(item.prd);

                let status = item.status;
                if (item.status == "OPEN")
                    status = '<button class="btn btn-warning"> OPEN </button>'

                let dname = (item.dname != undefined)? item.dname : item.tsym;
                let rej_reason = (item.rejreason != undefined)? item.rejreason : "";

                $('#order_book_table').append(`<tr>
                        <td class="order-num">${item.norenordno}</td>
                        <td>${status}</td>
                        <td>${dname}</td>
                        <td>${item.qty}</td>
                        <td>${buy_sell}</td>
                        <td>${item.avgprc === undefined? item.prc : item.avgprc}</td>
                        <td>${item.prctyp}</td>
                        <td>${item.norentm}</td>
                        <td>${rej_reason}</td>
                        <td>${item.remarks === undefined? "" : item.remarks}</td>
                        <td>${item.exch_tm === undefined? "": item.exch_tm}</td>
                        <td>${item.exch}</td>
                        <td>${prd}</td>
                        <td>${item.token}</td>
                        <td>${item.exchordid === undefined?"":item.exchordid}</td>
                </tr>`);
        },

        know_bull_or_bear: function(order) {
            let trade_type = "bull"
            if(order.exch === "NFO") {
                if(order.dname != undefined && order.dname != '') {  //"dname":"BANKNIFTY MAR FUT", "NIFTY 23MAR23 16000 PE ", "NIFTY 23MAR23 16000 CE ",
                    let dname = order.dname.trim()
                    if (dname.endsWith("PE")) {
                        if(order.trantype === "B") trade_type = "bear"
                        if(order.trantype === "S") trade_type = "bull"
                    }
                    else if (dname.endsWith("CE")) {
                        if(order.trantype === "B") trade_type = "bull"
                        if(order.trantype === "S") trade_type = "bear"
                    } else {
                        if(order.trantype === "S") trade_type = "bear"
                    }
                }
            } else if(order.exch === "NSE" || order.exch === "BSE") {
                if (order.trantype === "S") {
                    trade_type = "bear"
                }
            }

            return trade_type;
        },
    };

    class MileStone {
        constructor(ttype, buy_sell, token) {
            this.ttype = ttype ; //bull or bear trade
            this.buy_sell = buy_sell;
            this.token = token;
        }

        add_order_id(order_id) {
            this.order_id = order_id;
        }

        get_order_id() {
            return this.order_id;
        }

        get_token() {
            return this.token;
        }

        set_ttype(ttype) {
            this.ttype = ttype
        }

        set_buy_sell(buy_sell) {
            this.buy_sell = buy_sell
        }

        set_entry(entry) {
            this.entry = entry;
        }

        get_entry() {
            return this.entry;
        }

        set_target(target) {
            this.target = target;
        }

        get_target() {
            return this.target;
        }

        set_sl(sl) {
            this.sl = sl;
        }

        get_sl() {
            return this.sl;
        }

        del_entry() {
            delete this.entry
        }

        del_target() {
            delete this.target
        }

        del_sl() {
            delete this.sl
        }
    }

    class MileStoneManager {
        constructor() {
            this.milestones = {}
        }

        get_milestones() {
            return this.milestones;
        }

        get_value_object(val_str) {
            let spot_based = false;
            let instrument = 'price';
            let value = val_str;

            if(value != undefined && value != ''){
                value = value.trim();
                if(value.startsWith('N') || value.startsWith('n') || value.includes('B') || value.includes('b')
                    || value.includes('F') || value.includes('f')) {
                    spot_based = true
                    value = value.replace(/-/, '')
                    value = value.trim()
                    let ii = (value).charAt(0).toUpperCase()
                    if(ii === 'N')
                        instrument = 'nifty';
                    else if(ii === 'B')
                        instrument = 'bank_nifty'
                    else if(ii === 'F')
                        instrument = 'fin_nifty'
                    value = value.replace(/N|B|F|-| /i, '');
                }
            }

            return {spot_based : spot_based, value : value, instrument : instrument}
        }

        get_value_string(value_obj) {
            if(value_obj.spot_based) {
                let value_str = '';
                switch(value_obj.instrument) {
                    case 'nifty' : value_str = 'N '; break;
                    case 'bank_nifty' : value_str = 'B '; break;
                    case 'fin_nifty' : value_str = 'F '; break;
                }
                return value_str + value_obj.value.trim();
            } else {
                return value_obj.value.trim()
            }
        }

        add_entry(row_id, token, ttype, buy_sell, value_obj) {
            let old_ms = this.milestones[row_id]

            if(old_ms == undefined) {
                let ms = new MileStone(ttype, buy_sell, token);
                ms.set_entry(value_obj);
                this.milestones[row_id] = ms
            } else {
                old_ms.set_entry(value_obj)
            }
        }

        add_order_id(row_id, order_id) {
            let old_ms = this.milestones[row_id]
            if(old_ms != undefined) {
                old_ms.add_order_id(order_id)
            }
        }

        get_milestone(order_id) {
            for(const [row_id, milestone] of Object.entries(this.milestones)) {
                if(milestone.get_order_id() === order_id) {
                    return {
                        row_id : row_id,
                        milestone: milestone
                    };
                }
            }
        }

        add_target(row_id, token, ttype, buy_sell, value_obj) {
            let old_ms = this.milestones[row_id]

            if(old_ms == undefined) {
                let ms = new MileStone(ttype, buy_sell, token);
                ms.set_target(value_obj);
                this.milestones[row_id] = ms
            } else {
                old_ms.set_ttype(ttype)
                old_ms.set_target(value_obj)
            }
        }

        add_sl(row_id, token, ttype, buy_sell, value_obj) {
            let old_ms = this.milestones[row_id]

            if(old_ms == undefined) {
                let ms = new MileStone(ttype, buy_sell, token);
                ms.set_sl(value_obj);
                this.milestones[row_id] = ms
            } else {
                old_ms.set_ttype(ttype)
                old_ms.set_sl(value_obj)
            }
        }

        remove_entry(row_id) {
            let old_ms = this.milestones[row_id]
            if (old_ms != undefined) {
                old_ms.del_entry()
                if( old_ms.get_target()== undefined && old_ms.get_sl() == undefined) {
                    delete this.milestones[row_id]
                }
            }
        }

        entry_exists(row_id) {
            let old_ms = this.milestones[row_id]
            if (old_ms != undefined) {
               let entry = old_ms.get_entry();
               if(entry != undefined)
                    return true;
            }
            return false;
        }

        remove_target(row_id) {
            let old_ms = this.milestones[row_id]
            if (old_ms != undefined) {
                old_ms.del_target()
                if( old_ms.get_entry()=='undefined' && old_ms.get_sl() == 'undefined') {
                    delete this.milestones[row_id]
                }
            }
        }

        remove_sl(row_id) {
            let old_ms = this.milestones[row_id]
            if (old_ms != undefined) {
                old_ms.del_sl()
                if( old_ms.get_entry()=='undefined' && old_ms.get_target() == 'undefined') {
                    delete this.milestones[row_id]
                }
            }
        }

        remove_milestone(row_id) {
            delete this.milestones[row_id]
        }
    }

    const milestone_manager = new MileStoneManager();

    const trade = {

        max_profit_seen : {}, max_loss_seen :{},

        update_pnl : function(tr_elm, exit) {

            let params = {};
            params.ttype = tr_elm.attr('ttype');
            params.trtype = tr_elm.attr('trtype');
            params.trade_status = tr_elm.attr('trade');
            params.ltp = parseFloat(tr_elm.find('.ltp').text());
            params.entry = parseFloat(tr_elm.find('.entry').find('.price').text());
            params.qty = parseFloat(tr_elm.find('.qty').val());
            params.exit = parseFloat(exit);

            let pnl = trade.calculate_pnl(params)

            if (!isNaN(pnl)) {
                let gross_pnl = pnl * params.qty;

                let pnl_elm = tr_elm.find('.pnl');
                pnl_elm.html(gross_pnl.toFixed(2) + "</br><span class='price_diff'>" + pnl.toFixed(2) + "</span>")

                let row_id = tr_elm.attr('id');

                if (pnl < 0) {
                    pnl_elm.css('color', 'red')
                } else {
                    pnl_elm.css('color', 'green')
                }
                let ret = this.get_max_profit_loss(row_id, gross_pnl);

                let text = "Max profit seen : " + ret['profit'].toFixed(2) + "\nMax loss seen: " + ret['loss'].toFixed(2)
                pnl_elm.attr('title', text)
            } else {
                let pnl_elm = tr_elm.find('.pnl');
                pnl_elm.text('')
            }
        },

        get_max_profit_loss: function (row_id, total) {
            if(total > 0) {
                if(row_id in this.max_profit_seen) {
                    this.max_profit_seen[row_id] = Math.max(this.max_profit_seen[row_id], total)
                } else
                    this.max_profit_seen[row_id] = total
            } else {
                if (row_id in this.max_loss_seen) {
                    this.max_loss_seen[row_id] = Math.min(this.max_loss_seen[row_id], total)
                } else
                    this.max_loss_seen[row_id] = total
            }
            return {
                'profit': this.max_profit_seen[row_id] == undefined ? 0.0 : this.max_profit_seen[row_id],
                'loss': this.max_loss_seen[row_id] == undefined ? 0.0 : this.max_loss_seen[row_id]
            }
        },

        reset_max_profit_loss : function() {
            $('#max_profit_seen').text('')
            $('#max_loss_seen').text('')
            $('#total_pnl').text('')
            let row_id='total_row'
            this.max_profit_seen[row_id] = 0
            this.max_loss_seen[row_id] = 0
        },

        update_total_pnl : function() {
            let total = 0

            let rows = $('#active_trades_table, #active_paper_trades').find('tr')
            rows.each(function () {
                let pnl = $(this).find('td.pnl').text()
                total += parseFloat(pnl)
            })

            if (!isNaN(total)) {
                let total_pnl_elm = $('#total_pnl')
                const row_id = 'total_row';
                if (total < 0) {
                    total_pnl_elm.css('color', 'red')
                } else {
                    total_pnl_elm.css('color', 'green')
                }
                let ret = this.get_max_profit_loss(row_id, total);
                total_pnl_elm.text(total.toFixed(2))
                $('#max_profit_seen').text(ret['profit'].toFixed(2))
                $('#max_loss_seen').text(ret['loss'].toFixed(2))
            }
        },

        calculate_pnl: function(params)  {
            let pnl = 0.0;
            switch(params.trade_status) {
                case "pos" :
                case "active" :
                    pnl = get_pnl(params.trtype, params.entry, params.ltp)
                    break;
                case "closed":
                    pnl = get_pnl(params.trtype, params.entry, params.exit)
                    break;
            }

            return pnl;

            function get_pnl(trtype, entry, exit) {
                let pnl = 0.0;
                if (trtype == 'B') {
                    pnl = exit - entry;
                } else {
                    pnl = entry - exit;
                }
                return pnl;
            }
        },

        toggle_watch_closed_trade : function(elm) {
            if(elm.text() === "Watch") {
                elm.removeClass('badge-secondary')
                elm.addClass('badge-success')
                let tr_elm = elm.parent().parent()
                tr_elm.attr('trade', 'active')
                elm.text("Stop")
                elm.attr('title', "Stop live watching")
            } else {
                elm.removeClass('badge-success')
                elm.addClass('badge-secondary')
                let tr_elm = elm.parent().parent()
                tr_elm.attr('trade', 'closed')
                elm.text("Watch")
                elm.attr('title', "Watch live")
                show_success_msg("Resetting the P&L")
                setTimeout(function() {
                    trade.update_pnl(tr_elm, tr_elm.find('.exit-price').text())
                    trade.update_total_pnl()
                }, 1500)
            }
        },

        trigger: function() {
            let ms_list = milestone_manager.get_milestones();

            for( const [row_id, mile_stone] of Object.entries(ms_list)) {
                if(mile_stone.get_entry() != undefined) {// If it has entry object
                    // console.log('checking entry trigger')
                    check_entry_trigger(row_id, mile_stone)
                }

                if(mile_stone.get_target() != undefined) {// If it has target object
                    // console.log('checking target trigger')
                    check_target_trigger(row_id, mile_stone)
                }

                if(mile_stone.get_sl() != undefined) {// If it has sl object
                    // console.log('checking SL trigger')
                    check_sl_trigger(row_id, mile_stone)
                }
            }

            setTimeout(trade.trigger, 100)

            function check_entry_trigger(row_id, mile_stone) {
                let cur_spot_value = 0;
                let entry_obj = mile_stone.get_entry();
                let trig_value = parseFloat(entry_obj.value);
                let ttype = mile_stone.ttype;
                let buy_sell = mile_stone.buy_sell;
                if (entry_obj.spot_based) {
                    switch(entry_obj.instrument) {
                        case "nifty" : cur_spot_value = live_data[nifty_tk]; break;
                        case "bank_nifty" : cur_spot_value = live_data[bank_nifty_tk]; break;
                        case "fin_nifty" : cur_spot_value = live_data[fin_nifty_tk]; break;
                        default : console.error(row_id + " Spot based entry.. neither nifty nor bank-nifty " + mile_stone); break;
                    }
                }
                console.log(`Checking Entry : ${ttype}  spot : ${cur_spot_value}  trig : ${trig_value}`)

                //Only spot based entry should be checked. If it is price based then limit order will be placed
                if(entry_obj.spot_based) {
                    if (ttype === 'bull') {
                        if (cur_spot_value <= trig_value) {
                            entry_triggered()
                        }
                    } else if (ttype === 'bear') {
                        if (cur_spot_value >= trig_value) {
                            entry_triggered()
                        }
                    }
                }

                function entry_triggered() {

                    if(milestone_manager.entry_exists(row_id)) {  // To avoid duplicate execution
                        show_success_msg("Entry triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_spot_value)
                        console.log("Entry triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_spot_value)
                        console.log(entry_obj)
                        let tr_elm = $(`#${row_id}`)
                        tr_elm.find('.entry').val('') // Set entry value to '' in order to place market order
                        milestone_manager.remove_entry(row_id)
                        orderbook.place_buy_sell_order(tr_elm, tr_elm.attr('trtype'), function(data) {
                            orderbook.place_order_cb_carry_target_sl_to_active_trade(data, row_id)
                        })
                        tr_elm.remove();    //Remove entry from Open order table
                    }
                }
            }

            function close_all_trades() {
                let tbody_elm;
                if (is_paper_trade())
                    tbody_elm = $('#active_paper_trades')
                else
                    tbody_elm = $('#active_trades_table')

                tbody_elm.find('tr').each(function (index, tr_elm) {
                    $(tr_elm).find('.exit').click()
                })
                milestone_manager.remove_milestone('total_row');
            }

            function check_target_trigger(row_id, mile_stone) {
                let cur_spot_value = 0;
                let target_obj = mile_stone.get_target();
                let trig_value = parseFloat(target_obj.value);
                let ttype = mile_stone.ttype;
                let buy_sell = mile_stone.buy_sell;
                if (target_obj.spot_based) {
                    switch(target_obj.instrument) {
                        case "nifty" : cur_spot_value = live_data[nifty_tk]; break;
                        case "bank_nifty" : cur_spot_value = live_data[bank_nifty_tk]; break;
                        case "fin_nifty" : cur_spot_value = live_data[fin_nifty_tk]; break;
                        default : console.error(row_id + " .. Something is wrong .. " + mile_stone.token); break;
                    }
                } else { // Price based
                    if(row_id === "total_row") { // Use total P & L value in case of cumulative target and SL
                        cur_spot_value = $('#total_row').find('.pnl').text()
                        if(cur_spot_value!=undefined)
                            cur_spot_value = parseFloat(cur_spot_value)
                    }
                    else
                        cur_spot_value = live_data[mile_stone.token]
                }

                console.log(`Checking Target : ${ttype}  spot : ${cur_spot_value}  trig : ${trig_value}`)

                if (target_obj.spot_based) {
                    if (ttype === 'bull') {
                        if(cur_spot_value >= trig_value) {
                            target_triggered()
                        }
                    } else if (ttype === 'bear') {
                        if(cur_spot_value <= trig_value) {
                            target_triggered()
                        }
                    }
                } else if(target_obj.instrument === "price") {  //Price based
                    if(row_id === "total_row") {
                        if (cur_spot_value >= trig_value) {
                            target_triggered()
                        }
                    }
                    if (buy_sell === 'B') {
                        if(cur_spot_value >= trig_value) {
                            target_triggered()
                        }
                    } else if (buy_sell === 'S') {
                        if(cur_spot_value <= trig_value) {
                            target_triggered()
                        }
                    }
                }

                function target_triggered() {
                    show_success_msg("Target triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_spot_value)
                    console.log("Target triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_spot_value)
                    if(row_id === "total_row") {
                        //Close all trades
                        close_all_trades();
                    }
                    else {
                        let tr_elm = $(`#${row_id}`)
                        tr_elm.find('.exit').click();
                    }
                    milestone_manager.remove_milestone(row_id)
                }
            }


            function check_sl_trigger(row_id, mile_stone) {
                let cur_spot_value = 0;
                let sl_obj = mile_stone.get_sl();
                let trig_value = parseFloat(sl_obj.value);
                let ttype = mile_stone.ttype;
                let buy_sell = mile_stone.buy_sell;
                if (sl_obj.spot_based) {
                    switch(sl_obj.instrument) {
                        case "nifty" : cur_spot_value = live_data[nifty_tk]; break;
                        case "bank_nifty" : cur_spot_value = live_data[bank_nifty_tk]; break;
                        case "fin_nifty" : cur_spot_value = live_data[fin_nifty_tk]; break;
                    }
                } else { // Price based
                    if(row_id === "total_row") { // Use total P & L value in case of cumulative target and SL
                        cur_spot_value = $('#total_row').find('.pnl').text()
                        if(cur_spot_value!=undefined)
                            cur_spot_value = parseFloat(cur_spot_value)
                    }
                    else
                        cur_spot_value = live_data[mile_stone.token]
                }

                console.log(`Checking SL : ${ttype}  spot : ${cur_spot_value}  trig : ${trig_value}`)
                if(sl_obj.spot_based) {
                    if (ttype === 'bull') {
                        if (cur_spot_value <= trig_value) {
                            sl_triggered()
                        }
                    } else if (ttype === 'bear') {
                        if (cur_spot_value >= trig_value) {
                            sl_triggered()
                        }
                    }
                } else if(sl_obj.instrument === "price") {
                    if(row_id === "total_row") {
                        if (cur_spot_value <= trig_value) {
                            sl_triggered()
                        }
                    } else {
                        if (buy_sell === 'B') {
                            if (cur_spot_value <= trig_value) {
                                sl_triggered()
                            }
                        } else if (buy_sell === 'S') {
                            if (cur_spot_value >= trig_value) {
                                sl_triggered()
                            }
                        }
                    }
                }

                function sl_triggered() {
                    show_error_msg("SL triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_spot_value)
                    console.log("SL triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_spot_value)
                    if(row_id === "total_row") {
                        //Close all trades
                        close_all_trades()
                    }
                    else {
                        let tr_elm = $(`#${row_id}`)
                        tr_elm.find('.exit').click();
                    }
                    milestone_manager.remove_milestone(row_id)
                }
            }
        },

        display_active_trade : function(order, target, sl, paper_trade=false) {
            let ttype = orderbook.know_bull_or_bear(order)
            let buy_sell = '';
            let paper_tag = paper_trade?"Paper ":""
            if (order.trantype == "B") {
                buy_sell = `<span class="badge badge-success"> ${paper_tag} Buy</span>`
            } else {
                buy_sell = `<span class="badge badge-danger"> ${paper_tag} Sell</span>`
            }
            let dname = (order.dname != undefined)? order.dname : order.tsym;

            console.log("Active trade : " + JSON.stringify(order))
            ++unique_row_id;
            let row_id = "row_id_" + unique_row_id;

            let tbody_elm;
            if(paper_trade)
                tbody_elm = $('#active_paper_trades')
            else
                tbody_elm = $('#active_trades_table')

            tbody_elm.append(`<tr id="${row_id}" ordid="${order.norenordno}"  exch="${order.exch}" token="${order.token}" qty="${order.qty}" tsym="${order.tsym}" ttype="${ttype}" trtype="${order.trantype}" trade="active">
                        <td>${buy_sell}</td>
                        <td class="instrument">${dname}</td>
                        <td class="entry" title="Margin Used : ${(order.prc * order.qty).toFixed(2)}">
                            <span class="badge badge-pill badge-dark">${order.norentm.split(" ")[0]}</span>
                            </br><span class="badge badge-info">${order.remarks}</span>
                            <span class="price">${order.prc}</span></br>
                        </td>
                        <td class="trade_${order.token} ltp">${live_data[order.token]}</td>
                        <td class="pnl"></td>
                        <td><input type="text" disabled class="form-control target" placeholder="" value=""></td>
                        <td><input type="text" disabled class="form-control sl" placeholder="" value="" ></td>
                        <td><input type="text" class="form-control exit-limit" placeholder="" ></td>
                        <td><input type="text" class="form-control qty" placeholder=""  value="${order.qty}"></td>
                        <td><button type="button" class="btn btn-success modify" onclick="shoonya_api.trade.modify(this, $(this).text())">Edit</button></td>
                        <td><button type="button" class="btn btn-danger exit" onclick="shoonya_api.trade.exit(this)">Exit</button></td>
                </tr>`);

            if(target != undefined && target != '' ) {
                milestone_manager.add_target(row_id, order.token, ttype, order.trantype, milestone_manager.get_value_object(target))
                $('#' + row_id).find('.target').val(target)
            }
            if(sl != undefined && sl != '' ) {
                milestone_manager.add_sl(row_id, order.token, ttype, order.trantype, milestone_manager.get_value_object(sl))
                $('#' + row_id).find('.sl').val(sl)
            }

            this.fill_in_max_profit_loss_for_debit_spread(tbody_elm)
        },

        fill_in_max_profit_loss_for_debit_spread : function(tbody_elm) {
            let row_count = tbody_elm.children().length
            if(row_count === 2) { // When only two legs are present
                let row1 = $(tbody_elm.children()[0])
                let row2 = $(tbody_elm.children()[1])

                let instr1 = $(row1).find('.instrument').text().trim()
                let instr2 = $(row2).find('.instrument').text().trim()

                let leg1_type = instr1.split(" ").splice(-1)[0]
                let leg2_type = instr2.split(" ").splice(-1)[0]

                let qty = row1.attr('qty')

                //Check if it is debit spread
                if( leg1_type.trim() === leg2_type.trim()  &&       //Both are PE or both are CE
                    row1.attr('trtype') != row2.attr('trtype') &&   //If one leg is buy, other should be sell
                    row1.attr('qty') === row2.attr('qty') &&        //qty should be matching
                    row1.attr('exch') === row2.attr('exch') ) {

                    let strike1 = parseInt(instr1.split(" ").splice(2, 1)[0])
                    let strike2 = parseInt(instr2.split(" ").splice(2, 1)[0])

                    let spread = Math.abs(strike1-strike2)
                    let ltp1 = parseFloat(row1.find('.ltp').text())
                    let ltp2 = parseFloat(row2.find('.ltp').text())

                    let leg1_is_buy = row1.attr('trtype') == 'B'
                    let credit_spread
                    if(ltp1 < ltp2) {
                        if(leg1_is_buy)
                            credit_spread = true
                        else credit_spread = false
                    }

                    let break_even, max_profit, max_loss
                    if(credit_spread) {
                        let net_credit = Math.abs(ltp1-ltp2)
                        max_loss = (spread - net_credit) * qty
                        max_profit = net_credit * qty
                        break_even = strike2 - net_credit
                    } else {
                        let net_debit = Math.abs(ltp1-ltp2)
                        max_profit = (spread - net_debit) * qty
                        max_loss = net_debit * qty
                        break_even = strike1 - net_debit
                    }

                    $('#active_trades .max-profit-loss').html( (credit_spread?"Credit Spread": "Debit Spread") + "<br>Max profit = " + max_profit.toFixed(1) + "</br> Max loss = " + max_loss.toFixed(1) + "</br> Break-even=" + break_even.toFixed(0))
                }
            } else {
                $('#active_trades .max-profit-loss').html("")
            }
        },

        calculate_spreads : function() {
            let tbody_elm;
            if(is_paper_trade())
                tbody_elm = $('#active_paper_trades')
            else
                tbody_elm = $('#active_trades_table')

            trade.fill_in_max_profit_loss_for_debit_spread(tbody_elm)
            setTimeout(trade.calculate_spreads, 1000);
        },

        getCounterTradePosition : function(open_ord_tr_elm) {
            let token=open_ord_tr_elm.attr('token')
            let qty=open_ord_tr_elm.attr('qty')
            let counter_trtype=open_ord_tr_elm.attr('trtype') === 'B'? 'S': 'B'
            let exch=open_ord_tr_elm.attr('exch')

            console.log("Trying to find counter position : " + exch + "|" + token + " - " + qty + " trtype = " + counter_trtype);

            return this.getTradePosition(token, exch, counter_trtype, qty);
        },

        getTradePosition : function(token, exch, trtype, qty) {
            let position = $(`#active_trades_table tr[token=${token}][exch=${exch}][qty=${qty}][trtype=${trtype}]`)
            return position;
        },

        select_trade_type : function(select_opt, tr_elm) {
            let ttype = select_opt.value
            tr_elm.attr('ttype', ttype)
        },

        modify : function(elm, button_text, total_row=false) {
            let tr_elm = $(elm).parent().parent();

            if(button_text === 'Edit') {
                tr_elm.find('.target').removeAttr('disabled')
                tr_elm.find('.sl').removeAttr('disabled')
                $(elm).text('Done')
                if(total_row)
                    tr_elm.find('.form-select').removeAttr('disabled')

            } else {
                tr_elm.find('.target').attr('disabled', 'disabled')
                tr_elm.find('.sl').attr('disabled', 'disabled')
                $(elm).text('Edit')
                if(total_row)
                    tr_elm.find('.form-select').attr('disabled', 'disabled')

                let ordid = tr_elm.attr('ordid');
                let ttype = tr_elm.attr('ttype');
                let target = tr_elm.find('.target').val();
                let sl = tr_elm.find('.sl').val();

                let row_id = tr_elm.attr('id')
                let token = tr_elm.attr('token')
                let trtype = tr_elm.attr('trtype')

                if(target != undefined && target != '' ) {
                    milestone_manager.add_target(row_id, token, ttype, trtype, milestone_manager.get_value_object(target))
                } else milestone_manager.remove_target(row_id)

                if(sl != undefined && sl != '' ) {
                    milestone_manager.add_sl(row_id, token, ttype, trtype, milestone_manager.get_value_object(sl))
                } else milestone_manager.remove_sl(row_id)
            }
        },

        exit : function(elm) {
            shoonya_api.orderbook.exit_order(elm);
        },

        load_open_positions : function() {
            if(!is_paper_trade()) {
                // $('#active_trades_table').html("")
                positions.get_positions(function (positions) {
                    if (positions != undefined && positions.stat !== 'Not_Ok')
                        positions.forEach((position) => {
                            subscribe_token(position.exch + "|" + position.token);
                            trade.display_trade_position(position)
                        })
                })
            }
        },

        display_trade_position : function(pos) {
            if (pos.stat.toUpperCase() === "OK") {
                let buy_sell = '', trtype='';
                let price = pos.netavgprc;
                let qty = pos.netqty;
                if (qty > 0) {
                    buy_sell = '<span class="badge badge-success">Buy</span>'
                    trtype='B'
                } else {
                    buy_sell = '<span class="badge badge-danger">Sell</span>'
                    trtype='S'
                }
                pos.transtype = trtype;
                let ttype = orderbook.know_bull_or_bear(pos)
                qty = (qty < 0)? -1 * qty:qty; // Make it positive if it is negative
                let dname = (pos.dname != undefined) ? pos.dname : pos.tsym;

                if(qty >0) {
                    console.log("Open position : ", JSON.stringify(pos))

                    let position = trade.getTradePosition(pos.token, pos.exch, trtype, qty);

                    if(position.length == 0) { //Add new position only if it doesn't exist
                        console.log("Position doesn't exist in active trades. So adding it..")
                        $('#active_trades_table').append(`<tr id="row_id_${++unique_row_id}" exch="${pos.exch}" token="${pos.token}" tsym="${pos.tsym}" qty="${qty}" ttype="${ttype}" trtype="${trtype}" trade="active">
                            <td>${buy_sell}</td>
                            <td>${dname}</td>
                            <td class="entry">
<!--                                <span class="badge badge-pill badge-dark"></span></br>-->
                                <span class="price">${price}</span>
<!--                                </br><span class="badge badge-info"></span>-->
                            </td>
                            <td class="trade_${pos.token} ltp">${live_data[pos.token]}</td>
                            <td class="pnl"></td>
                            <td><input type="text" disabled class="form-control target" placeholder="" ></td>
                            <td><input type="text" disabled class="form-control sl" placeholder="" ></td>
                            <td><input type="text" class="form-control exit-limit" placeholder="" ></td>
                            <td><input type="text" class="form-control qty" placeholder=""  value="${qty}"></td>
                            <td><button type="button" class="btn btn-success modify" onclick="shoonya_api.trade.modify(this, $(this).text())">Edit</button></td>
                            <td><button type="button" class="btn btn-danger exit" onclick="shoonya_api.trade.exit(this)">Exit</button></td>
                        </tr>`);
                    }else {
                        console.log("Position is already present in active trades")
                    }
                }
            }
        },

        exit_all_positions : function() {
            if(!is_paper_trade()) {
                $('#open_orders tr').each(function (index, tr_elm) {
                    $(tr_elm).find('.cancel').click()
                })
                $('#active_trades_table tr').each(function (index, tr_elm) {
                    $(tr_elm).find('.exit').click()
                })
            } else {
                $('#active_paper_trades tr').each(function (index, tr_elm) {
                    $(tr_elm).find('.exit').click()
                })
            }
        },
    };

    const watch_list = {

        watched_items : {},

        save_watch_list : function() {
            let watch_list_str = JSON.stringify(this.watched_items);
            window.localStorage.setItem("watch_list", watch_list_str);
        },

        restore_watch_list : function() {
            $('#watch_list_body').html('')
            let watch_list_str = window.localStorage.getItem("watch_list");
            if(watch_list_str != null) {
                let stored_entries = JSON.parse(watch_list_str)
                for (const [key, value_str] of Object.entries(stored_entries)) {
                    shoonya_api.watch_list.add_row_to_watch(JSON.parse(value_str))
                }
            }
        },

        add_to_watchlist : function() {
            if(this.selection_is_valid()) {
                let params = {}
                params.sym = $('input.watch_item').val()
                params.lot_size = $('input.watch_item').attr('lot_size')
                params.exch = $('input.watch_item').attr('exch')
                params.token = $('input.watch_item').attr('token')
                params.tsym = $('input.watch_item').attr('tsym')
                params.dname = $('input.watch_item').attr('dname')
                let optt = $('input.watch_item').attr('optt')
                params.put_option = false
                if (optt === "PE" && params.exch === "NFO") {
                    params.put_option = true
                }

                watch_list.add_row_to_watch(params)
            } else {
                show_error_msg("Please select an instrument from the drop down")
            }
        },

        selection_is_valid : function() {
            let item = $('input.watch_item')
            let name = item.val().trim()
            let dname = item.attr('dname')
            if(dname != undefined) {
                dname = dname.trim()
                return name === dname
            } else {
                return true
            }
        },

        fin_nifty_dname_fix : function(tsym, dname) {
            //FINNIFTY13JUN23P19500 = tsym
            //FINNIFTY JUN 19500 PE = dname to be fixed
            if(tsym.startsWith('FINNIFTY')) {
                let date_str = tsym.replace('FINNIFTY', '').slice(0, 7)
                let month_str = date_str.substring(2,5)
                dname = dname.replace(month_str, date_str)
            }

            return dname
        },

        select_all : function(chk_elm) {
            $("#watch_list_body .select").each(function() {
                if(chk_elm.checked)
                    this.checked = true
                else
                    this.checked = false
            })
        },

        add_row_to_watch : function(params) {
            console.log("Add row to watch .. ", params.token)

            let sym_token = params.exch + '|' + params.token
            subscribe_token(sym_token)

            //Add to watched items
            watch_list.watched_items[`${params.exch}_${params.token}`] = JSON.stringify(params)
            watch_list.save_watch_list()

            let class_name = ''
            if(params.put_option) {
                class_name = 'table-danger'
            }

            $('#watch_list_body').append(`<tr class="${class_name}" exch="${params.exch}" token="${params.token}" tsym="${params.tsym}" lot_size="${params.lot_size}" dname="${params.sym}">
    
                <td> <input type="checkbox" class="select" value=""> </td>
                <td class="dname">${params.sym}</td>
                <th class="margin_req num"></th>
                <th class="watch_${params.token} ltp" lot_size="${params.lot_size}"></th>
                <td class="input_box"><input type="text" class="form-control entry" placeholder=""></td> <!--onclick="shoonya_api.watch_list.add_ltp(this)"-->
                <td class="input_box"><input type="text" class="form-control qty" placeholder="" value="${params.lot_size}"></td>
                <td><button type="button" class="btn btn-success buy" onclick="shoonya_api.orderbook.buy(this)">BUY</button></td>
                <td><button type="button" class="btn btn-danger sell" onclick="shoonya_api.orderbook.sell(this)">SELL</button></td>
                <th class="del-icon" onclick="shoonya_api.watch_list.delete_item(this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </th>
               </tr>`);
        },

        add_ltp : function(input_elm) {
            let row_elm = $(input_elm).parent().parent()
            $(input_elm).val(row_elm.find('.ltp').text())
        },

        delete_item : function(th_elm) {
            let tr_elm = $(th_elm).parent();
            let exch = tr_elm.attr('exch')
            let token = tr_elm.attr('token')

            delete watch_list.watched_items[`${exch}_${token}`]
            watch_list.save_watch_list()

            tr_elm.remove();
        },
    };

    const positions = {
        get_positions : function (success_cb) {

            let values          = {};
            values["uid"]       = user_id   ;
            values["actid"]     = user_id   ;

            let payload = get_payload(values)
            $.ajax({
                url: url.positions,
                type: "POST",
                dataType: "json",
                data: payload,
                success: function (data, textStatus, jqXHR) {
                    success_cb(data)
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.error("Ajax error")
                    show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                }
            });
        },

        show_positions : function() {
            $('#positions_table').html("")
            hide_other_tabs('#positions')
            this.get_positions(function(positions) {
                let pnl = {unrealized_pnl : 0.0, realized_pnl:0.0 };
                if (positions != undefined && positions.stat !== 'Not_Ok')
                    positions.forEach((position)=> shoonya_api.positions.show_position(position, pnl))

                $('#realized_pnl').html(pnl.realized_pnl.toFixed(2))
                $('#unrealized_pnl').html(pnl.unrealized_pnl.toFixed(2))

                color_pnl(pnl.realized_pnl, '#realized_pnl')
                color_pnl(pnl.unrealized_pnl, '#unrealized_pnl')

                function color_pnl(value, selector) {
                    if (value < 0) {
                        $(selector).removeClass()
                        $(selector).addClass('neg-mtm')
                    } else {
                        $(selector).removeClass()
                        $(selector).addClass('pos-mtm')
                    }
                }

            })
        },

        show_position : function(item, pnl) {

            if (item.stat != "Ok") {
                $('#positions_table').append(`<tr colspan="8"> ${item.emsg} </tr>`);
            } else {

                let prd = orderbook.get_prod_name(item.prd);
                let dname = (item.dname != undefined) ? item.dname : item.tsym;
                let mtm_ur = parseFloat(item.urmtom);
                let urmtm = (mtm_ur<0) ? `<span class='neg-mtm'>${mtm_ur}</span>`: `<span class='pos-mtm'>${mtm_ur}</span>`;
                let pnl_r = parseFloat(item.rpnl);
                pnl.realized_pnl += pnl_r;
                pnl.unrealized_pnl += mtm_ur;
                let rpnl = (pnl_r<0) ?  `<span class='neg-mtm'>${pnl_r}</span>`: `<span class='pos-mtm'>${pnl_r}</span>`;

                let cls='';
                if(item.netqty != undefined && item.netqty != '') {
                    let netqty = parseFloat(item.netqty);
                    if (netqty > 0)
                        cls = 'table-success'
                    else if (netqty < 0)
                        cls = 'table-danger'
                }

                $('#positions_table').append(`<tr class="${cls}" exch="${item.exch}" token-"${item.token}" tsym="${item.tsym}" lot_size="${item.ls}">
                        <td class="text">${dname}</td>
                        <td class="num">${urmtm}</td>
                        <td class="num">${rpnl}</td>
                        <td>${item.daybuyavgprc}</td>
                        <td>${item.daysellavgprc}</td>
                        <td>${item.daybuyqty}</td>
                        <td>${item.daysellqty}</td>
                        <td class="pos_${item.token} num ltp">${item.lp}</td>
                        <td>${prd}</td>
                        <td class="num">${item.daybuyamt}</td>
                        <td class="num">${item.daysellamt}</td>
                        <td class="num">${item.dayavgprc}</td>
                        <td class="num">${item.netqty}</td>
                        <td class="num">${item.netavgprc}</td>
                        <td>${item.exch}</td>
                </tr>`);
            }
        }
    };

    const is_paper_trade = function() {
        return document.getElementById('trade_type').checked == true
    };

    const toggle_paper_trade = function() {
        if(is_paper_trade()) {
            document.body.className = 'paper_trade';
        } else {
            document.body.className = 'real_trade';
        }
    };

    /*Attach functions to connect, add to watch list button, etc*/
    $(document).ready(function() {
        hide_other_tabs('#open_orders')
        $('#connect_to_server').click(function () {
            user_id = $('#userId').val()
            session_token = $('#sessionToken').val()
            connect()
            setTimeout(orderbook.update_open_orders, 100);
            setTimeout(trade.load_open_positions, 100);
            setTimeout(watch_list.restore_watch_list, 100);
            setTimeout(trade.trigger, 1000);
            //Uncomment below line to enable spreads dynamic calculation
            // setTimeout(trade.calculate_spreads, 2000);
        });
    });

    function hide_other_tabs(cur_tab) {
        let other_tabs = []
        switch(cur_tab) {
            case '#open_orders' : other_tabs = ['#order_book', '#positions']; break;
            case '#order_book' : other_tabs = ['#open_orders', '#positions']; break;
            case '#positions' : other_tabs = ['#open_orders', '#order_book']; break;
        }
        $(cur_tab).show();
        other_tabs.forEach((tab) => {
            $(tab).hide();
        })
    }

    return {
        "search_instrument" :  search_instrument,
        "connect" : connect,
        "post_request": post_request,
        "watch_list": watch_list,
        "orderbook": orderbook,
        "trade" : trade,
        "positions" : positions,
        "subscribed_symbols": subscribed_symbols,
        "live_data": live_data,
        "mgr": milestone_manager,
        "order_mgr" : open_order_mgr,
        "show_success_msg" : show_success_msg,
        "show_error_msg" : show_error_msg,
        "toggle_paper_trade": toggle_paper_trade,
    }

}();



$(document).ready(function(){
    $('button.close-btn').on('click', function (event) {
        event.preventDefault();
        $(this).parent().hide();
    });
})
