
shoonya_api = window.shoonya_api || {};

shoonya_api = function () {
    let alert_msg_disappear_after = 3000; // Unit milliseconds

    //TODO - Remove these hardcoded values
    let vix_tk = '26017', nifty_tk = '26000', bank_nifty_tk = '26009'
    let def_tokens = ["NSE|26017", "NSE|26000", "NSE|26009"]
    let user_id = '', session_token='', ws = '';

    let subscribed_symbols = [];
    let pending_to_subscribe_tokens = new Set();
    let logged_in = false;
    let live_data = {};

    const url = {
        websocket : "wss://shoonya.finvasia.com/NorenWSWeb/",
        search_instrument : "https://shoonya.finvasia.com/NorenWClientWeb/SearchScrip",
        order_book : "https://shoonya.finvasia.com/NorenWClientWeb/OrderBook",
        place_order : "https://shoonya.finvasia.com/NorenWClientWeb/PlaceOrder",
        modify_order : "https://shoonya.finvasia.com/NorenWClientWeb/ModifyOrder",
        cancel_order : "https://shoonya.finvasia.com/NorenWClientWeb/CancelOrder",
        exit_order : "https://shoonya.finvasia.com/NorenWClientWeb/ExitOrder",
        positions : "https://shoonya.finvasia.com/NorenWClientWeb/PositionBook",
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
        };

        ws.onmessage = function (event) {
            result = JSON.parse(event.data)
            if(result.t == 'ck') {
                 // trigger("open", [result]);
                if (result.s == 'OK') {
                    console.log('Login successful')
                    logged_in = true;
                    def_tokens.forEach(subscribe_token)
                }
            }
            if( result.t == 'tk' || result.t == 'tf') {

                function update_ltp(selector) {
                    $(selector).each(function(i, obj) {
                        $(obj).text(result.lp)

                        if(selector.startsWith('.trade')) {
                            $(obj).text(result.lp)
                            trade.update_pnl(obj)
                        }
                    });
                }

                if(result.lp != undefined)
                    live_data[result.tk] = parseFloat(result.lp).toFixed(2)

                switch (result.tk) {
                    case vix_tk:
                        $('#vix').html(result.lp)
                        break;
                    case nifty_tk:
                        $('#nifty').html(result.lp)
                        break;
                    case bank_nifty_tk:
                        $('#bank_nifty').html(result.lp)
                        break;
                    default:
                        update_ltp('.watch_' + result.tk);
                        update_ltp(".open_order_" + result.tk)  // In Open Order table
                        update_ltp(".trade_" + result.tk)  // In Active Trades table
                        break;
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
        if (!subscribed_symbols.includes(token)) {  // Subscribe only if not subscribed earlier
            pending_to_subscribe_tokens.add(token);
        }
        for(token of pending_to_subscribe_tokens.keys()) {
            let symtoken = {"t": "t", "k": token.concat('#')}
            // console.log(symtoken)
            if (ws.readyState != WebSocket.OPEN || !logged_in) {
                console.log("Web socket not ready yet..")
                setTimeout(function () {
                    subscribe_token(token)
                }, 10)
            } else {
                console.log("Web socket is ready.. Subscribing ", token)
                ws.send(JSON.stringify(symtoken));
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
            minLength: 3,
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
                                    return {
                                        label: item.dname != undefined? item.dname : item.tsym,
                                        value: item.dname != undefined? item.dname : item.tsym,
                                        tsym: item.tsym,
                                        lot_size: item.ls,
                                        exch: item.exch,
                                        token: item.token,
                                        optt :  item.optt
                                    };
                                }));
                            },
                        error: function (jqXHR, textStatus, errorThrown) {
                            console.log("Ajax error")
                        },
                    })},

            select: function (event, ui) {
                // when item is selected
                $(this).val(ui.item.value);
                $(this).attr('lot_size', ui.item.lot_size)
                $(this).attr('exch', ui.item.exch)
                $(this).attr('token', ui.item.token)
                $(this).attr('tsym', ui.item.tsym)
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

    let unique_row_id = 0;
    const orderbook = {

        get_order_status : function(orderno, closing_order_id) {
            console.log("Getting order status for : ", orderno)
            this.get_orderbook(function(orders) {
                let matching_order = orders.find(order => order.norenordno === orderno)
                if(matching_order != undefined) {
                    console.log(matching_order)
                    switch (matching_order.status) {
                        case "COMPLETE": //TODO AMO ORDER
                            console.log("Order completed.. " + orderno)
                            if(closing_order_id == undefined) {
                                matching_order.prc = matching_order.avgprc; // When order status is COMPLETE avgprc field contains the correct price
                                const ms_obj = milestone_manager.get_milestone(orderno);
                                let target = ''; sl = '';
                                if(ms_obj != undefined) {
                                    const old_row_id = ms_obj.row_id;
                                    target = milestone_manager.get_value_string(ms_obj.milestone.target)
                                    sl = milestone_manager.get_value_string(ms_obj.milestone.sl)
                                    milestone_manager.remove_milestone(old_row_id); //Target and SL have been taken into Active Trade Row
                                }
                                trade.display_active_trade(matching_order, target, sl);
                            } else {
                                matching_order.prc = matching_order.avgprc; // Exit price
                                console.log(closing_order_id + " exited.. with " + orderno)
                                trade.remove_active_trade(closing_order_id)
                            }
                            display_order_exec_msg(matching_order);
                            break;
                        default:
                            display_order_exec_msg(matching_order);
                            break;
                    }
                }
            })

            function display_order_exec_msg(order) {
                switch (order.status) {
                    case "OPEN" :
                        $('#order_success_msg').html("Order is open. Order number: " + orderno + "  Symbol: " + order.tsym + " Qty: " + order.qty);
                        $('#order_success_alert').removeClass('d-none');
                        setTimeout(function(){
                            // $('#order_success_msg').html("");
                            $('#order_success_alert').addClass('d-none')}, alert_msg_disappear_after);
                        break;
                    case "COMPLETE" :
                        $('#order_success_msg').html("Order completed. Order number: " + orderno + "  Symbol: " + order.tsym + " Qty: " + order.qty);
                        $('#order_success_alert').removeClass('d-none');
                        setTimeout(function(){
                            // $('#order_success_msg').html("");
                            $('#order_success_alert').addClass('d-none')}, alert_msg_disappear_after);
                        break;
                    case "REJECTED" :
                        $('#order_error_msg').html("Order " + orderno + " rejected. Reason : " + order.rejreason  + "   Symbol: " + order.tsym + " Qty: " + order.qty );
                        $('#order_error_alert').removeClass('d-none');
                        setTimeout(function(){
                            // $('#order_error_msg').html("");
                            $('#order_error_alert').addClass('d-none')}, alert_msg_disappear_after);
                        break;
                    case "CANCELED":
                        $('#order_success_msg').html("Order " + orderno + " cancelled successfully. Symbol: " + order.tsym + " Qty: " + order.qty );
                        $('#order_success_alert').removeClass('d-none');
                        setTimeout(function(){
                            // $('#order_success_msg').html("");
                            $('#order_error_alert').addClass('d-none')}, alert_msg_disappear_after);
                        break;
                    default:
                        console.log('Default order status : ')
                        console.log(JSON.stringify(order))
                        break;
                }
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
                }
            });
        },

        update_open_order_list : function(orders) {
            $('#open_order_list').html('')
            orders.forEach(orderbook.add_open_order)
        },

        add_open_order : function(item) {
            if (item.status == "OPEN") {
                let type = item.amo == "Yes"? "AMO ": "";
                let buy_sell = '';
                if (item.trantype == "B") {
                    buy_sell = '<span class="badge badge-success">' + type + 'Buy</span>'
                } else {
                    buy_sell = '<span class="badge badge-danger">' + type + 'Sell</span>'
                }
                let ttype = orderbook.know_bull_or_bear(item)

                let dname = (item.dname != undefined)? item.dname : item.tsym;
                $('#open_order_list').append(`<tr id="row_id_${++unique_row_id}" ordid="${item.norenordno}" exch="${item.exch}" tsym="${item.tsym}" 
                                    qty="${item.qty}" token="${item.token}" ttype="${ttype}" trtype="${item.trantype}"">
                        <td>${buy_sell}</td>
                        <td class="order-num">${item.norenordno}</td>
                        <td>${dname}</td>
                        <th class="open_order_${item.token} ltp"></th>
                        <td><input type="text" class="form-control entry" placeholder=""  value="${item.prc}"></td>
                        <td><input type="text" class="form-control target" placeholder=""  value=""></td>
                        <td><input type="text" class="form-control sl" placeholder=""  value=""></td>
                        <td><input type="text" class="form-control qty" placeholder=""  value="${item.qty}"></td>
    
                        <td><button type="button" class="btn btn-success modify" onclick="shoonya_api.orderbook.modify_order(this)">Modify</button></td>
                        <td><button type="button" class="btn btn-danger cancel" onclick="shoonya_api.orderbook.cancel_order(this)">Cancel</button></td>
                </tr>`);

                let token = item.exch + "|" + item.token
                subscribe_token(token)
            }
        },

        place_order : function(tr_elm, buy_sell, success_cb) {
            tr_elm.find('.buy').attr('disabled', 'disabled');
            tr_elm.find('.sell').attr('disabled', 'disabled');

            let entry_val = tr_elm.find('.entry').val()
            console.log("Inside place order : " + entry_val)
            if(entry_val == undefined) entry_val = 0.0;
            let entry_obj = milestone_manager.get_value_object(entry_val);
            let qty = tr_elm.find('.qty').val()

            let params = this.get_order_params(tr_elm, buy_sell, entry_obj, qty)
            if (entry_obj.spot_based) {
                this.add_to_spot_order_list(params, entry_val)
            } else {
                post_request(url.place_order, params, success_cb)
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
            $('#open_order_list').append(`<tr id="${row_id}" ordid="${item.norenordno}" exch="${item.exch}" tsym="${item.tsym}" qty="${item.qty}" token="${item.token}" ttype="${ttype}" trtype="${item.trantype}">
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
                milestone_manager.add_entry(row_id, item.token, ttype, entry_obj);
        },

        place_order_success_cb : function(data, closing_order_id) {
            console.log("Place order success cb : ", data.norenordno)
            if( data.norenordno != undefined) {
                shoonya_api.orderbook.get_order_status(data.norenordno, closing_order_id)
                orderbook.update_open_orders();
            }else if ( data.result != undefined) {
                shoonya_api.orderbook.get_order_status(data.result)  //For cancel order, order-id is contained in result variable
                orderbook.update_open_orders();
            }
        },

        update_open_orders : function() {
            hide_other_tabs('#open_orders')
            orderbook.get_orderbook(orderbook.update_open_order_list)
        },

        get_order_params: function(elm, buy_or_sell, entry, qty) {

            let prctyp = 'LMT', price = "0.0";
            let remarks = "";
            let tsym = elm.attr('tsym');
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
                }
            }

            let values          =  {'ordersource':'WEB'};
            values["uid"]       = user_id;
            values["actid"]     = user_id;
            values["trantype"]  = buy_or_sell;
            values["prd"]       = prd;
            values["exch"]      = exch;
            values["tsym"]      = tsym;
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
                let entry_obj = milestone_manager.get_value_object(entry_value);
                milestone_manager.remove_milestone(row_id);

            } else {

                let values            = {'ordersource':'WEB'};
                values["uid"]         = user_id;
                values["norenordno"]  = orderno;

                post_request(url.cancel_order, values, function (data) {
                    if (data.stat.toUpperCase() === "OK")
                        tr_elm.remove();
                    shoonya_api.orderbook.place_order_success_cb(data)
                });
            }
        },

        modify_order : function(td_elm) {
            let tr_elm = $(td_elm).parent().parent();
            let orderno = tr_elm.find('.order-num').html()
            let entry_value = tr_elm.find('.entry').val()
            let row_id = tr_elm.attr('id')
            let ttype = tr_elm.attr('ttype')
            let token = tr_elm.attr('token')

            if(orderno.includes('Spot')) {  // Spot based entry
                let entry_obj = milestone_manager.get_value_object(entry_value)
                milestone_manager.add_entry(row_id, token, ttype, entry_obj)

            } else {

                let prctyp = 'LMT', price = "0.0";
                if (entry_value == '') {
                    prctyp = 'MKT'
                } else price = entry_value.toString()

                let qty = tr_elm.find('.qty').val()

                let values = {'ordersource': 'WEB'};
                values["uid"] = user_id;
                values["actid"] = user_id;
                values["norenordno"] = orderno;
                values["exch"] = tr_elm.attr('exch');
                values["tsym"] = tr_elm.attr('tsym');
                values["qty"] = qty;
                values["prctyp"] = prctyp;
                values["prc"] = price;

                post_request(url.modify_order, values, orderbook.place_order_success_cb);
            }

            let target_value = tr_elm.find('.target').val()

            if(target_value == undefined || target_value == '') {
                milestone_manager.remove_target(row_id);
            } else { // Target has some value
                let target_obj = milestone_manager.get_value_object(target_value)
                milestone_manager.add_target(row_id, token, ttype, target_obj);
            }

            let sl_value = tr_elm.find('.sl').val()

            if(sl_value == undefined || sl_value == '') {
                milestone_manager.remove_sl(row_id);
            } else {  // SL has some value
                let sl_obj = milestone_manager.get_value_object(sl_value)
                milestone_manager.add_sl(row_id, token, ttype, sl_obj);
            }
        },

        //TODO - Partial quantity exit should be done
        exit_order : function(td_elm) {
            let tr_elm = $(td_elm).parent().parent();
            let orderno = tr_elm.attr('ordid')
            let limit_value = tr_elm.find('.exit-limit').val()
            let qty = tr_elm.find('.qty').val()

            let buy_sell= tr_elm.attr('trtype') == 'B' ? 'S' : 'B'; // Do the opposite
            let exit_limit = milestone_manager.get_value_object(limit_value);
            let values = orderbook.get_order_params(tr_elm, buy_sell, exit_limit, qty)
            post_request(url.place_order, values, function(data){
                if(data.stat.toUpperCase() === "OK") {
                    milestone_manager.remove_milestone(tr_elm.attr('id'))
                    tr_elm.remove();
                }
                orderbook.place_order_success_cb(data, orderno)
            });
        },

        show_orderbook : function() {
            $('#order_book_table').html("")
            hide_other_tabs('#order_book')
            this.get_orderbook(function(orders) {
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
                        <td>${item.prc}</td>
                        <td>${item.prctyp}</td>
                        <td>${item.norentm}</td>
                        <td>${rej_reason}</td>
                        <td>${item.remarks}</td>
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
                    if (dname.endsWith("PE") && order.trantype === "B") {
                        trade_type = "bear"
                    } else if (dname.endsWith("CE") && order.trantype === "S") {
                        trade_type = "bear"
                    } else if (order.trantype === "S") {
                        trade_type = "bear"
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
        constructor(ttype, token) {
            this.ttype = ttype ; //bull or bear trade
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
                if(value.startsWith('N') || value.startsWith('n') || value.includes('B') || value.includes('b')) {
                    spot_based = true
                    instrument = (value).toUpperCase().startsWith('N') ? 'nifty' : 'bank_nifty'
                    value = value.replace(/N|B|-| /i, '');
                }
            }

            return {spot_based : spot_based, value : value, instrument : instrument}
        }

        get_value_string(value_obj) {
            if(value_obj.spot_based) {
                let value_str = '';
                value_str = value_obj.instrument === 'nifty' ? 'N ': 'B ';
                return value_str + value_obj.value;
            } else {
                return value_obj.value
            }
        }

        add_entry(row_id, token, ttype, value_obj) {
            let old_ms = this.milestones[row_id]

            if(old_ms == undefined) {
                let ms = new MileStone(ttype, token);
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

        add_target(row_id, token, ttype, value_obj) {
            let old_ms = this.milestones[row_id]

            if(old_ms == undefined) {
                let ms = new MileStone(ttype, token);
                ms.set_target(value_obj);
                this.milestones[row_id] = ms
            } else {
                old_ms.set_target(value_obj)
            }
        }

        add_sl(row_id, token, ttype, value_obj) {
            let old_ms = this.milestones[row_id]

            if(old_ms == undefined) {
                let ms = new MileStone(ttype, token);
                ms.set_sl(value_obj);
                this.milestones[row_id] = ms
            } else {
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
        active_trades : {},

        update_pnl : function(ltp_elm){
            let tr_elm = $(ltp_elm).parent();
            let ttype = tr_elm.attr('ttype');
            let ltp = parseFloat($(ltp_elm).text());
            let entry = parseFloat(tr_elm.find('.entry').find('.price').text());
            let qty = parseFloat(tr_elm.find('.qty').val());

            let pnl = 0.0;
            if(ttype === "bull") {
                pnl = ltp - entry;
            } else {
                pnl = entry - ltp;
            }

            if (!isNaN(pnl)) {
                pnl = pnl * qty;
                let pnl_elm = tr_elm.find('.pnl');
                pnl_elm.text(pnl.toFixed(2))
                if (pnl < 0) {
                    pnl_elm.css('color', 'red')
                } else {
                    pnl_elm.css('color', 'green')
                }
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

            setTimeout(trade.trigger, 1000)

            function check_entry_trigger(row_id, mile_stone) {
                let cur_spot_value = 0;
                let entry_obj = mile_stone.get_entry();
                let trig_value = parseFloat(entry_obj.value);
                let ttype = mile_stone.ttype;
                if (entry_obj.spot_based) {
                    switch(entry_obj.instrument) {
                        case "nifty" : cur_spot_value = live_data[nifty_tk]; break;
                        case "bank_nifty" : cur_spot_value = live_data[bank_nifty_tk]; break;
                        default : console.error(row_id + " Spot based entry.. neither nifty nor bank-nifty " + mile_stone); break;
                    }
                }
                if (ttype === 'bull') {
                    if (cur_spot_value <= trig_value) {
                        entry_triggered()
                    }
                } else if (ttype === 'bear') {
                    if (cur_spot_value >= trig_value) {
                        entry_triggered()
                    }
                }

                function entry_triggered() {

                    if(milestone_manager.entry_exists(row_id)) {  // To avoid duplicate execution

                        console.log("Entry triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_spot_value)
                        console.log(entry_obj)
                        let tr_elm = $(`#${row_id}`)
                        tr_elm.find('.entry').val('') // Set entry value to '' in order to place market order

                        orderbook.place_order(tr_elm, tr_elm.attr('trtype'), function (data) {
                            milestone_manager.remove_entry(row_id)
                            let order_id = data.norenordno;
                            let ms = milestone_manager.add_order_id(row_id, order_id);
                            orderbook.place_order_success_cb(data);
                        })
                        tr_elm.remove()
                    }
                }
            }

            function check_target_trigger(row_id, mile_stone) {
                let cur_spot_value = 0;
                let target_obj = mile_stone.get_target();
                let trig_value = parseFloat(target_obj.value);
                let ttype = mile_stone.ttype;
                if (target_obj.spot_based) {
                    switch(target_obj.instrument) {
                        case "nifty" : cur_spot_value = live_data[nifty_tk]; break;
                        case "bank_nifty" : cur_spot_value = live_data[bank_nifty_tk]; break;
                        default : console.error(row_id + " .. Something is wrong .. " + mile_stone.token); break;
                    }
                } else { // Price based
                    cur_spot_value = live_data[mile_stone.token]
                }
                if (ttype === 'bull') {
                    if (cur_spot_value >= trig_value) {
                        target_triggered()
                    }
                } else if (ttype === 'bear') {
                    if (cur_spot_value <= trig_value) {
                        target_triggered()
                    }
                }

                function target_triggered() {
                    console.log("Target triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_spot_value)
                    let tr_elm = $(`#${row_id}`)
                    tr_elm.find('.entry').text('') // Set entry value to '' in order to place market order
                    // let trtype = tr_elm.attr('trtype') ==='B'? 'S' : 'B'    //Do the opposite to close position
                    // orderbook.place_order(tr_elm, trtype)
                    orderbook.exit_order(tr_elm.find('.exit'))
                    tr_elm.remove()
                    milestone_manager.remove_milestone(row_id)
                }
            }

            function check_sl_trigger(row_id, mile_stone) {
                let cur_spot_value = 0;
                let sl_obj = mile_stone.get_sl();
                let trig_value = parseFloat(sl_obj.value);
                let ttype = mile_stone.ttype;
                if (sl_obj.spot_based) {
                    switch(sl_obj.instrument) {
                        case "nifty" : cur_spot_value = live_data[nifty_tk]; break;
                        case "bank_nifty" : cur_spot_value = live_data[bank_nifty_tk]; break;
                    }
                } else { // Price based
                    cur_spot_value = live_data[mile_stone.token]
                }
                if (ttype === 'bull') {
                    if (cur_spot_value <= trig_value) {
                        sl_triggered()
                    }
                } else if (ttype === 'bear') {
                    if (cur_spot_value >= trig_value) {
                        sl_triggered()
                    }
                }

                function sl_triggered() {
                    console.log("SL triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_spot_value)
                    let tr_elm = $(`#${row_id}`)
                    tr_elm.find('.entry').val('') // Set entry value to '' in order to place market order
                    // let trtype = tr_elm.attr('trtype') ==='B'? 'S' : 'B'    //Do the opposite to close position
                    // orderbook.place_order(tr_elm, trtype)
                    orderbook.exit_order(tr_elm.find('.exit'))
                    tr_elm.remove()
                    milestone_manager.remove_milestone(row_id)
                }
            }
        },

        display_active_trade : function(order, target, sl) {
            let ttype = orderbook.know_bull_or_bear(order)
            let buy_sell = '';
            if (order.trantype == "B") {
                buy_sell = '<span class="badge badge-success">Buy</span>'
            } else {
                buy_sell = '<span class="badge badge-danger">Sell</span>'
            }
            let dname = (order.dname != undefined)? order.dname : order.tsym;

            console.log("Active trade : " + JSON.stringify(order))
            ++unique_row_id;
            let row_id = "row_id_" + unique_row_id;

            $('#active_trades_table').append(`<tr id="${row_id}" ordid="${order.norenordno}"  exch="${order.exch}" token="${order.token}" tsym="${order.tsym}" ttype="${ttype}" trtype="${order.trantype}">
                        <td>${buy_sell}</td>
                        <td>${dname}</td>
                        <td class="entry">
                            <span class="badge badge-pill badge-dark">${order.norentm.split(" ")[0]}</span>
                            </br><span class="price">${order.prc}</span></br>
                            <span class="badge badge-primary">${order.remarks}</span>
                        </td>
                        <td class="trade_${order.token} ltp"></td>
                        <td class="pnl"></td>
                        <td><input type="text" disabled class="form-control target" placeholder="" value=""></td>
                        <td><input type="text" disabled class="form-control sl" placeholder="" value="" ></td>
                        <td><input type="text" class="form-control exit-limit" placeholder="" ></td>
                        <td><input type="text" class="form-control qty" placeholder=""  value="${lot_size}"></td>
                        <td><button type="button" class="btn btn-success modify" onclick="shoonya_api.trade.modify(this, $(this).text())">Edit</button></td>
                        <td><button type="button" class="btn btn-danger exit" onclick="shoonya_api.trade.exit(this)">Exit</button></td>
                </tr>`);

            if(target != undefined && target != '' ) {
                milestone_manager.add_target(row_id, token, ttype, milestone_manager.get_value_object(target))
                $('#' + row_id).find('.target').val(target)
            }
            if(sl != undefined && sl != '' ) {
                milestone_manager.add_sl(row_id, token, ttype, milestone_manager.get_value_object(sl))
                $('#' + row_id).find('.sl').val(sl)
            }
        },

        remove_active_trade : function(closing_order_id) {
            console.log("Removing order id :" , closing_order_id)
            let tr_elm = $('#active_trades_table tr').find(`[ordid="${closing_order_id}"]`)
            tr_elm.remove()
        },

        modify : function(elm, button_text) {
            let tr_elm = $(elm).parent().parent();

            if(button_text === 'Edit') {
                tr_elm.find('.target').removeAttr('disabled')
                tr_elm.find('.sl').removeAttr('disabled')
                $(elm).text('Done')
            } else {
                tr_elm.find('.target').attr('disabled', 'disabled')
                tr_elm.find('.sl').attr('disabled', 'disabled')
                $(elm).text('Edit')

                let ordid = tr_elm.attr('ordid');
                let ttype = tr_elm.attr('ttype');
                let target = tr_elm.find('.target').val();
                let sl = tr_elm.find('.sl').val();

                let row_id = tr_elm.attr('id')
                let token = tr_elm.attr('token')
                let trtype = tr_elm.attr('trtype')
                if(target != undefined && target != '' ) {
                    milestone_manager.add_target(row_id, token, ttype, milestone_manager.get_value_object(target))
                }
                if(sl != undefined && sl != '' ) {
                    milestone_manager.add_sl(row_id, token, ttype, milestone_manager.get_value_object(sl))
                }
            }
        },

        exit : function(elm) {
            shoonya_api.orderbook.exit_order(elm);
        },

        load_open_positions : function() {
            $('#active_trades_table').html("")
            positions.get_positions(function(positions) {
                if (positions != undefined && positions.stat !== 'Not_Ok')
                    positions.forEach((position)=> {
                        subscribe_token(position.exch+"|"+position.token);
                        trade.display_trade_position(position)})
            })
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
                    $('#active_trades_table').append(`<tr id="row_id_${++unique_row_id}" ordid="open_position" exch="${pos.exch}" token="${pos.token}" tsym="${pos.tsym}" ttype="${ttype}" trtype="${trtype}">
                            <td>${buy_sell}</td>
                            <td>${dname}</td>
                            <td class="entry">
<!--                                <span class="badge badge-pill badge-dark"></span></br>-->
                                <span class="price">${price}</span>
<!--                                </br><span class="badge badge-primary"></span>-->
                            </td>
                            <td class="trade_${pos.token} ltp"></td>
                            <td class="pnl"></td>
                            <td><input type="text" disabled class="form-control target" placeholder="" ></td>
                            <td><input type="text" disabled class="form-control sl" placeholder="" ></td>
                            <td><input type="text" class="form-control exit-limit" placeholder="" ></td>
                            <td><input type="text" class="form-control qty" placeholder=""  value="${qty}"></td>
                            <td><button type="button" class="btn btn-success modify" onclick="shoonya_api.trade.modify(this, $(this).text())">Edit</button></td>
                            <td><button type="button" class="btn btn-danger exit" onclick="shoonya_api.trade.exit(this)">Exit</button></td>
                    </tr>`);
                }
            }
        },

        exit_all_positions : function() {
            $('#active_trades_table tr').each(function(index, tr_elm) {
                $(tr_elm).find('.exit').click()
            })
        }
    };

    const watch_list = {
        add_to_watchlist : function() {
            sym = $('input.watch_item').val()
            lot_size = $('input.watch_item').attr('lot_size')
            exch = $('input.watch_item').attr('exch')
            token = $('input.watch_item').attr('token')
            tsym = $('input.watch_item').attr('tsym')
            optt = $('input.watch_item').attr('optt')
            put_option = false
            if (optt === "PE" && exch === "NFO") {
                put_option = true
            }
            this.add_row_to_watch(sym, lot_size, exch, token, tsym, put_option)
        },

        add_row_to_watch : function(sym, lot_size, exch, token, tsym, put_option) {
            console.log("Add row to watch .. ", token)
            let symtoken = exch + '|' + token
            subscribe_token(symtoken)
            class_name = ''
            if(put_option) {
                class_name = 'table-danger'
            }

            $('#watch_list_body').append(`<tr class="${class_name}" exch="${exch}" token="${token}" tsym="${tsym}" lot_size="${lot_size}">
    
                <td>${sym}</td>
                <th class="watch_${token} ltp"></th>
                <td><input type="text" class="form-control entry" placeholder="" ></td>
                <td><input type="text" class="form-control qty" placeholder="" value="${lot_size}"></td>
                <td><button type="button" class="btn btn-success buy" onclick="shoonya_api.orderbook.place_order($(this).parent().parent(), 'B')">BUY</button></td>
                <td><button type="button" class="btn btn-danger sell" onclick="shoonya_api.orderbook.place_order($(this).parent().parent(), 'S')">SELL</button></td>
                <th class="del-icon" onclick="shoonya_api.delete_row(this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </th>
               </tr>`);
        }
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
    }

    /*Attach functions to connect, add to watch list button, etc*/
    $(document).ready(function() {
        hide_other_tabs('#open_orders')
        $('#connect_to_server').click(function () {
            user_id = $('#userId').val()
            session_token = $('#sessionToken').val()
            connect()
            setTimeout(orderbook.update_open_orders, 100);
            setTimeout(trade.load_open_positions, 100);
            setTimeout(trade.trigger, 1000);
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


    function delete_row(elm) {
        $(elm).parent().remove();
    }

    return {
        "search_instrument" :  search_instrument,
        "connect" : connect,
        "delete_row": delete_row,
        "post_request": post_request,
        "watch_list": watch_list,
        "orderbook": orderbook,
        "trade" : trade,
        "positions" : positions,
        "subscribed_symbols": subscribed_symbols,
        "live_data": live_data,
        "mgr": milestone_manager,
    }

}();



$(document).ready(function(){

})
