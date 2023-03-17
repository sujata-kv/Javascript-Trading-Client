
shoonya_api = window.shoonya_api || {};

shoonya_api = function () {
    let alert_msg_disappear_after = 6000; // Unit milliseconds

    //TODO - Remove these hardcoded values
    let vix_tk = '26017', nifty_tk = '26000', bank_nifty_tk = '26009'
    let def_tokens = ["NSE|26017", "NSE|26000", "NSE|26009"]
    let user_id = '', session_token='', ws = '';

    let subscribed_symbols = [];
    let pending_to_subscribe_tokens = new Set();
    let logged_in = false;

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
                 // trigger("quote", [result]);
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
                        let elm = document.getElementById(result.tk)
                        $(elm).html(result.lp)
                        elm = document.getElementById("open_order_" + result.tk)  // In Active Trades table
                        $(elm).html(result.lp)
                        elm = document.getElementById("pos_" + result.tk)  // In Active Trades table
                        $(elm).html(result.lp)
                        break;
                }
            }
            if( result.t == 'dk' || result.t == 'df') {
                 // trigger("quote", [result]);
            }
            if(result.t == 'om') {
                console.log("..................  OM ...................")
                console.log(result)
            }


            // console.log(res)
            // if ('s' in res) {
            //     if (res.s == 'OK') {
            //         console.log('Login successful')
            //         subscribe_tokens(def_tokens)
            //     }
            // } else if ('lp' in res) {
            //     // console.log(res.tk + " " + res.lp)
            //     switch (res.tk) {
            //         case vix_tk:
            //             $('#vix').html(res.lp)
            //             break;
            //         case nifty_tk:
            //             $('#nifty').html(res.lp)
            //             break;
            //         case bank_nifty_tk:
            //             $('#bank_nifty').html(res.lp)
            //             break;
            //         default:
            //             let elm = document.getElementById(res.tk)
            //             $(elm).html(res.lp)
            //             elm = document.getElementById("open_order_" + res.tk)  // In Active Trades table
            //             $(elm).html(res.lp)
            //             break;
            //     }
            // }
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
            console.log(symtoken)
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
                console.log("Ajax success");
                console.log(data)
                console.log(jqXHR)
                console.log(textStatus)
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
                                console.log("Ajax success")
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

    const orderbook = {

        get_order_status : function(orderno, trade_info) {
            this.get_orderbook(function(orders) {
                let matching_order = orders.find(order => order.norenordno === orderno)
                if(matching_order != undefined) {
                    console.log(matching_order)
                    switch (matching_order.status) {
                        case "COMPLETE": trade.display_active_trade(matching_order); break;
                        default: display_order_exec_msg(matching_order); break;
                    }
                }
            })

            function display_order_exec_msg(order) {
                switch (order.status) {
                    case "OPEN" :
                        $('#order_success_msg').html("Order is open. Order number: " + orderno + "  Symbol: " + order.tsym + " Qty: " + order.qty);
                        $('#order_success_alert').removeClass('d-none');
                        setTimeout(function(){$('#order_success_alert').addClass('d-none')}, alert_msg_disappear_after);
                        break;
                    case "COMPLETE" :
                        $('#order_success_msg').html("Order completed. Order number: " + orderno + "  Symbol: " + order.tsym + " Qty: " + order.qty);
                        $('#order_success_alert').removeClass('d-none');
                        setTimeout(function(){$('#order_success_alert').addClass('d-none')}, alert_msg_disappear_after);
                        break;
                    case "REJECTED" :
                        $('#order_error_msg').html("Order " + orderno + " rejected. Reason : " + order.rejreason  + "   Symbol: " + order.tsym + " Qty: " + order.qty );
                        $('#order_error_alert').removeClass('d-none');
                        setTimeout(function(){$('#order_error_alert').addClass('d-none')}, alert_msg_disappear_after);
                        break;
                    default:
                        alert("Default order status" + JSON.stringify(order))
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


                let dname = (item.dname != undefined)? item.dname : item.tsym;
                $('#open_order_list').append(`<tr exch="${item.exch}" tsym="${item.tsym}" qty="${item.qty}" token="${item.token}">
                        <td scope="row">${buy_sell}</td>
                        <td class="order-num">${item.norenordno}</td>
                        <td>${dname}</td>
                        <th id="open_order_${item.token}" class="ltp"></th>
                        <td><input type="text" class="form-control entry" placeholder="" aria-label="strike"
                                                    aria-describedby="basic-addon1" value="${item.prc}"></td>
                        <td><input type="text" class="form-control target" placeholder="" aria-label="strike"
                                                   aria-describedby="basic-addon1" value=""></td>
                        <td><input type="text" class="form-control sl" placeholder="" aria-label="strike"
                                                   aria-describedby="basic-addon1" value=""></td>
                        <td><input type="text" class="form-control qty" placeholder="" aria-label="strike"
                                                   aria-describedby="basic-addon1" value="${item.qty}"></td>
    
                        <td><button type="button" class="btn btn-success" onclick="shoonya_api.orderbook.modify_order(this)">Modify</button></td>
                        <td><button type="button" class="btn btn-danger" onclick="shoonya_api.orderbook.cancel_order(this)">Cancel</button></td>
                </tr>`);

                let token = item.exch + "|" + item.token
                subscribe_token(token)
            }
        },

        get_entry_object : function(pelm) {
            entry = pelm.find('.entry').val()
            spot_based_entry = false;

            if(entry != undefined && entry != '' && (entry.includes('N') || entry.includes('B'))) {
                spot_based_entry = true
            }

            return {spot_based_entry : spot_based_entry, value : entry.replace(/N|B/g, '').trim()}
        },

        buy : function(elm) {
            pelm = $(elm).parent().parent();
            entry = orderbook.get_entry_object(pelm);
            qty = pelm.find('.qty').val()

            if (entry.spot_based_entry) {
                console.log('Place waiting order')
            } else {
                params = orderbook.get_order_params(pelm, 'B', entry, qty)
                let reply = post_request(url.place_order, params, this.place_order_success_cb)
                console.log("Buy reply = ", reply)
                return reply;
            }
        },

        sell : function(elm) {
            pelm = $(elm).parent().parent();
            entry = orderbook.get_entry_object(pelm);
            qty = pelm.find('.qty').val()

            if (entry.spot_based_entry) {
                console.log('Place waiting order')
            } else {
                params = orderbook.get_order_params(pelm, 'S', entry, qty)
                let reply = post_request(url.place_order, params, this.place_order_success_cb)
                console.log("Sell reply = ", reply)
                return reply;
            }
        },

        place_order_success_cb : function(data) {
            if( data.norenordno != undefined) {
                shoonya_api.orderbook.get_order_status(data.norenordno)
                orderbook.update_open_orders();
            }
        },

        update_open_orders : function() {
            orderbook.get_orderbook(orderbook.update_open_order_list)
        },

        get_order_params: function(elm, buy_or_sell, entry, qty) {

            let prctyp = 'LMT', price = "0.0";
            if(entry.value == '') {
                prctyp = 'MKT'
            } else price = entry.value.toString()
            let exch = elm.attr('exch');
            /* "C" For CNC, "M" FOR NRML, "I" FOR MIS, "B" FOR BRACKET ORDER, "H" FOR COVER ORDER*/
            if(exch == "NSE" || exch == "BSE") {
                prd = "C";
            } else {
                prd = "M";
            }

            let values          =  {'ordersource':'WEB'};
            values["uid"]       = user_id;
            values["actid"]     = user_id;
            values["trantype"]  = buy_or_sell;
            values["prd"]       = prd;
            values["exch"]      = exch;
            values["tsym"]      = elm.attr('tsym');
            values["qty"]       = qty;
            values["dscqty"]    = qty;
            values["prctyp"]    = prctyp       /*  LMT / MKT / SL-LMT / SL-MKT / DS / 2L / 3L */
            values["prc"]       = price;
            values["ret"]       = 'DAY';

            // values["amo"] = "Yes";          // AMO ORDER

            return values;
        },

        cancel_order : function(td_elm) {
            relm = $(td_elm).parent().parent();
            orderno = relm.find('.order-num').html()

            let values            = {'ordersource':'WEB'};
            values["uid"]         = user_id;
            values["norenordno"]  = orderno;

            let reply = post_request(url.cancel_order, values, function() {relm.remove()});
            console.log('Cancel order reply = ', reply)

            //TODO - Temp code added.. Fix later
            setTimeout(shoonya_api.orderbook.get_orderbook(shoonya_api.orderbook.place_order_success_cb), 10)
            return reply;
        },

        modify_order : function(td_elm) {
            let relm = $(td_elm).parent().parent();
            let orderno = relm.find('.order-num').html()
            let limit_value = relm.find('.entry').val()

            let prctyp = 'LMT', price = "0.0";
            if(limit_value == '') {
                prctyp = 'MKT'
            } else price = limit_value.toString()

            let qty = relm.find('.qty').val()

            let values                  = {'ordersource':'WEB'};
            values["uid"]           = user_id;
            values["actid"]         = user_id;
            values["norenordno"]    = orderno;
            values["exch"]          = relm.attr('exch');
            values["tsym"]          = relm.attr('tsym');
            values["qty"]           = qty;
            values["prctyp"]        = prctyp;
            values["prc"]           = price;

            let reply = post_request(url.modify_order, values);

            //TODO - Temp code added.. Fix later
            setTimeout(shoonya_api.orderbook.get_orderbook(shoonya_api.orderbook.place_order_success_cb), 10)
            return reply;
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
                    // status = '<span class="badge badge-warning"> OPEN </span>'
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
                        <td>${item.exch_tm === undefined? "": item.exch_tm}</td>
                        <td>${item.exch}</td>
                        <td>${prd}</td>
                        <td>${item.token}</td>
                        <td>${item.exchordid === undefined?"":item.exchordid}</td>
                </tr>`);
        },


    };

    const trade = {
        show_active_trades : function() {
            hide_other_tabs('#active_trades')
        },

        display_active_trade : function(item) {
            let buy_sell = '';
            if (item.trantype == "B") {
                buy_sell = '<span class="badge badge-success">Buy</span>'
            } else {
                buy_sell = '<span class="badge badge-danger">Sell</span>'
            }
            let dname = (item.dname != undefined)? item.dname : item.tsym;

            $('#active_trades_table').append(`<tr>
                        <td>${buy_sell}</td>
                        <td>${dname}</td>
                        <td class="entry">${item.prc}</td>
                        <td id="trade_${item.token}" class="ltp"></td>
                        <td class="pnl"></td>
                        <td><input type="text" class="form-control target" placeholder="" aria-label="limit" aria-describedby="basic-addon1"></td>
                        <td><input type="text" class="form-control sl" placeholder="" aria-label="limit" aria-describedby="basic-addon1"></td>
                        <td><input type="text" class="form-control exit-limit" placeholder="" aria-label="limit" aria-describedby="basic-addon1"></td>
                        <td><input type="text" class="form-control qty" placeholder="" aria-label="qty" aria-describedby="basic-addon1" value="${lot_size}"></td>
                        <td><button type="button" class="btn btn-success" onclick="shoonya_api.trade.modify(this)">Modify</button></td>
                        <td><button type="button" class="btn btn-danger" onclick="shoonya_api.trade.exit(this)">Exit</button></td>
                </tr>`);
        },

        modify : function(elm) {

        },

        exit : function(elm) {

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
            if (optt == "PE" && exch == "NFO") {
                put_option = true
            }
            this.add_row_to_watch(sym, lot_size, exch, token, tsym, put_option)
        },

        add_row_to_watch : function(sym, lot_size, exch, token, tsym, put_option) {
            subscribe_token( exch + '|' + token)
            class_name = ''
            if(put_option) {
                class_name = 'table-danger'
            }

            $('#watch_list_body').append(`<tr class="${class_name}" exch="${exch}" tsym="${tsym}" lot_size="${lot_size}">
    
                <td>${sym}</td>
                <th id="${token}"></th>
                <td><input type="text" class="form-control entry" placeholder="" aria-label="limit" aria-describedby="basic-addon1"></td>
                <td><input type="text" class="form-control qty" placeholder="" aria-label="qty" aria-describedby="basic-addon1" value="${lot_size}"></td>
                <td><button type="button" class="btn btn-success" onclick="shoonya_api.orderbook.buy(this)">BUY</button></td>
                <td><button type="button" class="btn btn-danger" onclick="shoonya_api.orderbook.sell(this)">SELL</button></td>
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
                    console.log("Ajax success")
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
                positions.forEach((position)=> shoonya_api.positions.show_position(position))
            })
        },

        show_position : function(item) {

            if (item.stat != "Ok") {
                $('#positions_table').append(`<tr colspan="8"> ${item.emsg} </tr>`);
            } else {

                let prd = orderbook.get_prod_name(item.prd);
                let dname = (item.dname != undefined) ? item.dname : item.tsym;
                let mtm_ur = parseFloat(item.urmtom);
                let urmtm = (mtm_ur<0) ? `<span class='neg-mtm'>${mtm_ur}</span>`: `<span class='pos-mtm'>${mtm_ur}</span>`;
                let pnl_r = parseFloat(item.rpnl);
                let rpnl = (pnl_r<0) ?  `<span class='neg-mtm'>${pnl_r}</span>`: `<span class='pos-mtm'>${pnl_r}</span>`;
                let id = `pos_${item.token}`
                //<td>${item.tsym}</td>
                $('#positions_table').append(`<tr>
                        <td class="text">${dname}</td>
                        <td class="num">${urmtm}</td>
                        <td class="num">${rpnl}</td>
                        <td>${item.daybuyavgprc}</td>
                        <td>${item.daysellavgprc}</td>
                        <td>${item.daybuyqty}</td>
                        <td>${item.daysellqty}</td>
                        <td id=${id} class="num ltp">${item.lp}</td>
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
        $('#connect_to_server').click(function () {
            user_id = $('#userId').val()
            session_token = $('#sessionToken').val()
            connect()
            setTimeout(orderbook.update_open_orders, 100);
        });
    });

    function hide_other_tabs(cur_tab) {
        let other_tabs = []
        switch(cur_tab) {
            case '#active_trades' : other_tabs = ['#order_book', '#positions']; break;
            case '#order_book' : other_tabs = ['#active_trades', '#positions']; break;
            case '#positions' : other_tabs = ['#active_trades', '#order_book']; break;
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
    }

}();



$(document).ready(function(){

})
