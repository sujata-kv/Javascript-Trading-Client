client_api = window.client_api || {};

client_api = function () {

    let conf = {
        atm_strike_check_interval : 60000,
        atm_premium_monitor_interval : 30000,
        target_sl_check_interval: 1000,
        algo: {
            atm_pct_diff: 10,
            profit_pct : 10,
            loss_pct : 10,
            monitor_interval: 1000,
            retry_count : 4,
            bank_nifty: {
                tolerate_deviation: 180,
                qty: 15,
                round_to: 100,
            },
            nifty : {
                tolerate_deviation: 100,
                qty: 50,
                round_to: 50,
            },
            fin_nifty : {
                tolerate_deviation: 100,
                qty: 40,
                round_to: 50,
            }
        },
    }
    
    let alert_msg_disappear_after = 3000; // Unit milliseconds
    let heartbeat_timeout = 7000;
    let vix_tk, nifty_tk, bank_nifty_tk, fin_nifty_tk = '';
    let user_id = '', session_token='', ws = '';
    let subscribed_symbols = []
    let pending_to_subscribe_tokens = new Set();
    let logged_in = false;
    let live_data = {};
    let broker = '';
    let instruments = ['nifty', 'bank_nifty', 'fin_nifty']

    function select_broker() {
        let broker_name = $('#broker_option')[0].value

        if (broker_name === "kite") {
            broker = kite
            user_id = $('#login-creds .kite-creds .user-id').val()
            session_token = $('#login-creds .kite-creds .session-token').val()

            $('#login-creds .kite-creds').removeClass('d-none')
            $('#login-creds .shoonya-creds').addClass('d-none')
        } else if (broker_name === "shoonya") {
            broker = shoonya
            user_id = $('#login-creds .shoonya-creds .user-id').val()
            session_token = $('#login-creds .shoonya-creds .session-token').val()

            $('#login-creds .shoonya-creds').removeClass('d-none')
            $('#login-creds .kite-creds').addClass('d-none')
        }
    }

    function login_status(success) {
        if(success) {
            logged_in = true
            console.log("Login success..")
            $('#connection_status').css('color', 'green')
        } else {
            logged_in = false
            $('#connection_status').css('color', 'red')
        }
    }

    let shoonya = {
        name: "shoonya",

        url: {
            websocket: "wss://trade.shoonya.com/NorenWSWeb/",
            search_instrument: "https://trade.shoonya.com/NorenWClientWeb/SearchScrip",
            order_book: "https://trade.shoonya.com/NorenWClientWeb/OrderBook",
            place_order: "https://trade.shoonya.com/NorenWClientWeb/PlaceOrder",
            modify_order: "https://trade.shoonya.com/NorenWClientWeb/ModifyOrder",
            cancel_order: "https://trade.shoonya.com/NorenWClientWeb/CancelOrder",
            exit_order: "https://trade.shoonya.com/NorenWClientWeb/ExitOrder",
            positions: "https://trade.shoonya.com/NorenWClientWeb/PositionBook",
        },

        init: function () {
            vix_tk = '26017', nifty_tk = '26000', bank_nifty_tk = '26009', fin_nifty_tk = '26037';
            subscribed_symbols = ["NSE|26017", "NSE|26000", "NSE|26009", "NSE|26037"];
        },

        connect: function () {
            ws = new WebSocket(this.url.websocket);
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

                console.log("Session data sent")

                setInterval(function () {
                    if (ws.readyState == WebSocket.OPEN) {
                        var _hb_req = '{"t":"h"}';
                        ws.send(_hb_req);
                    }
                }, heartbeat_timeout);
            };

            ws.onmessage = function (event) {
                result = JSON.parse(event.data)
                if (result.t == 'ck') {
                    if (result.s == 'OK') {
                        // console.log('On message : ck OK')
                        console.log('Login successful')
                        login_status(true)
                        subscribed_symbols.forEach(shoonya.subscribe_token)
                    }
                }
                if (result.t == 'tk' || result.t == 'tf') {
                    // console.log('On message : ' + result.t)
                    if (result.lp != undefined) {
                        let instr_token = result.tk
                        let ltpf = parseFloat(result.lp).toFixed(2)
                        live_data[instr_token] = ltpf
                        update_ltps(instr_token, ltpf)
                    }
                }
                if (result.t == 'dk' || result.t == 'df') {
                    console.log('On message : ' + result.t)
                    // trigger("quote", [result]);
                }
                if (result.t == 'om') {
                    console.log('On message : ' + result.t)
                    // console.log("..................  OM ...................")
                    console.log(result)
                }
            }

            ws.onclose = function (event) {
                login_status(false)
                console.log('WebSocket is closed. Reconnect will be attempted in 1 second.', event.reason);
                setTimeout(function () {
                    shoonya.connect();
                }, 1000);
            };

            ws.onerror = function (event) {
                login_status(false)
                console.error("WebSocket error: ", event);
            };
        },

        get_subscribe_token: function (params) {
            return params.exch + '|' + params.token
        },

        get_ticker: function (params) {
            return params.token;
        },

        subscribe_token: function (token) {

            pending_to_subscribe_tokens.add(token);

            for (token of pending_to_subscribe_tokens.keys()) {
                let symtoken = {"t": "t", "k": token.concat('#')}
                if (ws.readyState != WebSocket.OPEN || !logged_in) {
                    console.log("Web socket not ready yet.. ", token)
                    setTimeout(function () {
                        shoonya.subscribe_token(token)
                    }, 1000)

                } else {
                    console.log("Web socket is ready.. Subscribing ", token)
                    if (!logged_in) {
                        login_status(true)
                    }

                    ws.send(JSON.stringify(symtoken));
                    if (!subscribed_symbols.includes(token))
                        subscribed_symbols.push(token);
                    pending_to_subscribe_tokens.delete(token);
                }
            }
        },

        get_payload: function (params) {
            let payload = 'jData=' + JSON.stringify(params);
            payload = payload + "&jKey=" + session_token;
            return payload
        },

        post_request: function (url, params, success_cb, failure_cb) {
            let payload = shoonya.get_payload(params)
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
        },

        position : {
            get_positions: function (success_cb) {

                let values = {};
                values["uid"] = user_id;
                values["actid"] = user_id;

                let payload = shoonya.get_payload(values)
                $.ajax({
                    url: broker.url.positions,
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
        },

        search: {
            search_subscribe_strike: function (instrument, strike) {
                let params = {
                    "uid": user_id,
                    "stext": instrument.replace('_', '') + " " + strike
                }
                $.ajax({
                    url: shoonya.url.search_instrument,
                    type: "POST",
                    dataType: "json",
                    data: shoonya.get_payload(params),
                    success: function (data, textStatus, jqXHR) {
                        // console.log("Ajax success")
                        let info1 = data.values[0]; // One is CE other is PE
                        let info2 = data.values[1];
                        atm_tracker.atm_strike_details[instrument] = [ get_strike_details(info1, strike), get_strike_details(info2, strike)]

                        function get_strike_details(info, strike) {
                            return {
                                strike: strike,
                                optt: info.optt,
                                token: info.token,
                                exch: info.exch,
                                tsym: info.tsym,
                                dname: info.dname,
                                value: info.dname,
                                lot_size: info.ls,
                                qty: conf.algo[instrument].qty,
                                algo : true,
                            }
                        }

                        shoonya.subscribe_token('NFO|' + info1.token);
                        shoonya.subscribe_token('NFO|' + info2.token);

                        console.log(instrument.toUpperCase() + " ATM strike: " + strike);
                        console.log(atm_tracker.atm_strike_details[instrument])
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.log("Ajax error")
                        show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                    },
                })
            },

            attach_search_autocomplete: function () {
                /* Search instrument autocomplete */
                $("input.search-instrument").autocomplete({
                    minLength: 2,
                    autoFocus: true,
                    appendTo: '#instr-drop-down',
                    source: function (request, response) {
                        params = {"uid": user_id, "stext": request.term}
                        $.ajax({
                            url: shoonya.url.search_instrument,
                            type: "POST",
                            dataType: "json",
                            data: shoonya.get_payload(params),
                            success: function (data, textStatus, jqXHR) {
                                // console.log("Ajax success")
                                response($.map(data.values, function (item) {
                                    item.dname = watch_list.fin_nifty_dname_fix(item.tsym, item.dname)
                                    let dname = item.dname != undefined ? item.dname : item.tsym;
                                    return {
                                        label: dname,
                                        value: dname,
                                        tsym: item.tsym,
                                        dname: dname,
                                        lot_size: item.ls,
                                        exch: item.exch,
                                        token: item.token,
                                        optt: item.optt
                                    };
                                }));
                            },
                            error: function (jqXHR, textStatus, errorThrown) {
                                console.log("Ajax error")
                                show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                            },
                        })
                    },

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
            }
        },

        order : {
            get_order_params: function (elm, buy_or_sell, entry, qty) {

                let prctyp = 'LMT', price = "0.0";
                let remarks = "";
                let tsym = elm.attr('tsym');
                let dname = elm.attr('dname');
                let token = elm.attr('token');
                let instrument_token = elm.attr('instrument_token');
                if (entry.value == '') {
                    prctyp = 'MKT'
                } else
                    price = entry.value.toString()
                let exch = elm.attr('exch');
                /* "C" For CNC, "M" FOR NRML, "I" FOR MIS, "B" FOR BRACKET ORDER, "H" FOR COVER ORDER*/
                if (exch == "NSE" || exch == "BSE") {
                    prd = "I";
                } else {
                    prd = "M";
                    if (tsym != undefined) {
                        if (tsym.startsWith("NIFTY"))
                            remarks = "N-" + Math.round(live_data[nifty_tk])
                        else if (tsym.startsWith("BANKNIFTY"))
                            remarks = "B-" + Math.round(live_data[bank_nifty_tk])
                        else if (tsym.startsWith("FINNIFTY"))
                            remarks = "F-" + Math.round(live_data[fin_nifty_tk])
                        remarks += " Vix " + live_data[vix_tk]
                    }
                }

                let values = {'ordersource': 'WEB'};
                values["uid"] = user_id;
                values["actid"] = user_id;
                values["trantype"] = buy_or_sell;
                values["prd"] = prd;
                values["exch"] = exch;
                values["tsym"] = tsym;
                values["dname"] = dname;
                values["token"] = token;
                values["instrument_token"] = instrument_token;
                values["qty"] = qty;
                values["dscqty"] = qty;
                values["prctyp"] = prctyp       /*  LMT / MKT / SL-LMT / SL-MKT / DS / 2L / 3L */
                values["prc"] = price;
                values["ret"] = 'DAY';
                values["remarks"] = remarks;

                // values["amo"] = "Yes";          // TODO - AMO ORDER

                return values;
            },

            get_algo_order_params : function(params, buy_or_sell) {
                let prctyp = 'MKT', price = "0.0";
                let remarks = "";
                let tsym = params.tsym;
                let dname = params.dname;
                let token = params.token;
                let qty = params.qty.toString();
                let instrument_token = params.instrument_token;
                let exch = params.exch;

                /* "C" For CNC, "M" FOR NRML, "I" FOR MIS, "B" FOR BRACKET ORDER, "H" FOR COVER ORDER*/
                if (exch == "NSE" || exch == "BSE") {
                    prd = "I";
                } else {
                    prd = "M";
                    if (tsym != undefined) {
                        if (tsym.startsWith("NIFTY"))
                            remarks = "N-" + Math.round(live_data[nifty_tk])
                        else if (tsym.startsWith("BANKNIFTY"))
                            remarks = "B-" + Math.round(live_data[bank_nifty_tk])
                        else if (tsym.startsWith("FINNIFTY"))
                            remarks = "F-" + Math.round(live_data[fin_nifty_tk])
                        remarks += " Vix " + live_data[vix_tk]
                    }
                }

                let values = {'ordersource': 'WEB'};
                values["uid"] = user_id;
                values["actid"] = user_id;
                values["trantype"] = buy_or_sell;
                values["prd"] = prd;
                values["exch"] = exch;
                values["tsym"] = tsym;
                values["dname"] = dname;
                values["token"] = token;
                values["instrument_token"] = instrument_token;
                values["qty"] = qty;
                values["dscqty"] = qty;
                values["prctyp"] = prctyp       /*  LMT / MKT / SL-LMT / SL-MKT / DS / 2L / 3L */
                values["prc"] = price;
                values["ret"] = 'DAY';
                values["remarks"] = remarks;

                return values;
            },

            place_order: function (params, success_cb) {
                shoonya.post_request(shoonya.url.place_order, params, success_cb);
            },

            cancel_order: function (tr_elm, orderno, success_cb) {
                let values = {'ordersource': 'WEB'};
                values["uid"] = user_id;
                values["norenordno"] = orderno;

                shoonya.post_request(broker.url.cancel_order, values, function (data) {
                    if (data.stat.toUpperCase() === "OK")
                        tr_elm.remove();

                    if (data.result != undefined) {
                        let orderno = data.result;  //For cancel order, order-id is contained in result variable
                        broker.get_orderbook(success_cb)
                    }
                });
            },

            modify_order: function (tr_elm, entry_obj, success_call_bk) {
                let prctyp = 'LMT', price = "0.0";
                if (entry_obj.value == '') {
                    prctyp = 'MKT'
                } else price = entry_obj.value;

                let qty = tr_elm.find('.qty').val()
                let order_id = tr_elm.find('.order-num').html()

                let values = {'ordersource': 'WEB'};
                values["uid"] = user_id;
                values["actid"] = user_id;
                values["exch"] = tr_elm.attr('exch');
                values["tsym"] = tr_elm.attr('tsym');
                values["qty"] = qty;
                values["prctyp"] = prctyp;
                values["prc"] = price;

                values["norenordno"] = order_id;

                shoonya.post_request(broker.url.modify_order, values, function (data) {
                    if (data.stat == "Ok") {
                        let orderno = data.result;  // In case of modify and cancel order 'result' contains order ID.
                        data.orderno = orderno
                        success_call_bk(data)
                        show_success_msg("Order with order num : " + orderno + " modified successfully")
                    } else show_error_msg(data.emsg)
                })
            },

            get_orderbook: function (success_cb) {
                let values = {};
                values["uid"] = user_id;
                let payload = shoonya.get_payload(values)
                $.ajax({
                    url: broker.url.order_book,
                    type: "POST",
                    dataType: "json",
                    data: payload,
                    success: function (data, textStatus, jqXHR) {
                        if (jqXHR.status == 200) {
                            console.log("get_orderbook success")
                        }

                        for (const [key, order] of Object.entries(data)) {
                            order['subscribe_token'] = shoonya.get_subscribe_token(order)      //Add subscribe_token field.. specific to shoonya
                        }
                        success_cb(data)
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.log("Ajax error : ", JSON.stringify(jqXHR))
                        if (jqXHR.status == 401)
                            login_status(false)
                        show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                    }
                });
            },

            exit_order : function(values, success_cb) {
                shoonya.post_request(shoonya.url.place_order, values, success_cb);
            },
        }
    }

    const atm_tracker = {
        atm_strike_details: {},
        atm_strikes: {},

        find_atm_strike_price: function (instrument) {
            let round_to = conf.algo[instrument].round_to;
            let mod = Math.round(this.get_ltp(instrument) % round_to);
            let strike_price;
            if (mod < round_to/2)
                strike_price = Math.floor(this.get_ltp(instrument) / round_to) * round_to;
            else
                strike_price = Math.ceil(this.get_ltp(instrument) / round_to) * round_to;
            return strike_price
        },

        get_ltp: function (instrument) {
            switch (instrument) {
                case 'nifty':
                    return live_data[nifty_tk];
                    break;
                case 'bank_nifty':
                    return live_data[bank_nifty_tk];
                    break;
                case 'fin_nifty':
                    return live_data[fin_nifty_tk];
                    break;
                default :
                    return NaN;
                    break;
            }
        },

        find_atm_strikes: function () {
            if(logged_in) {
                instruments.forEach(function (instr) {
                    let strike = atm_tracker.find_atm_strike_price(instr);
                    let str = instr + "_" + strike
                    if (atm_tracker.atm_strikes[instr] !== str) {
                        //New strike found
                        console.log("New strike price found for " + instr + " " + strike)
                        broker.search.search_subscribe_strike(instr, strike)
                        atm_tracker.atm_strikes[instr] = str;
                    }
                })
            }
            setTimeout(atm_tracker.find_atm_strikes, conf.atm_strike_check_interval); //Keep looping to find ATM strike price
        },

        display_atm_prices: function () {
            if(logged_in) {
                var time = new Date().toLocaleTimeString();
                let str = time.replace(/ AM| PM/, "") + " "
                instruments.forEach(function (instr) {
                    let details = atm_tracker.atm_strike_details[instr]
                    str = str + instr.toUpperCase()[0]
                    if (details != undefined && details.length == 2) {
                        str = str + "-<span class='strike'>" + details[0]['strike'] + "</span> "
                        let ce_idx = 0, pe_idx = 1;
                        if (details[0]['optt'] === "PE") {
                            ce_idx = 1;
                            pe_idx = 0
                        }
                        let total_premium = parseFloat(live_data[details[ce_idx]['token']]) + parseFloat(live_data[details[pe_idx]['token']])
                        str = str + "<span class='prem'>" + total_premium.toFixed(0) + "</span> "
                    }
                })
                $('#prem-display').prepend(str + "<br>")
            }
            setTimeout(atm_tracker.display_atm_prices, conf.atm_premium_monitor_interval)
        },
    }

    const algo = {
        deploy_stats : {},
        deployed : false,
        deploying : false,
        run : function(instrument) {
            console.log("Algo run function called for " + instrument)
            if(!algo.deployed && !algo.deploying) {
                algo.deploying = true;
                let atm_ce_pe = atm_tracker.atm_strike_details[instrument]
                if (atm_ce_pe != undefined && atm_ce_pe.length == 2) {   // CE and PE both present
                    let ltp1 = live_data[atm_ce_pe[0].token];
                    let ltp2 = live_data[atm_ce_pe[1].token];
                    let pct_diff = Math.abs(ltp1 - ltp2) / Math.min(ltp1, ltp2);
                    console.log(atm_ce_pe[0].strike + "  Ltp1= " + ltp1 + " Ltp2= " + ltp2 + " % Diff = " + (pct_diff * 100).toFixed(0))
                    if (pct_diff <= conf.algo.atm_pct_diff/100) {
                        console.log(`Deploying algo for ${instrument}..`)
                        algo.deploy_straddle(instrument, atm_ce_pe)
                    } else {
                        console.log("Not deploying algo as the difference between ATM premiums is more than "+ conf.algo.atm_pct_diff + "%")
                        algo.deploying = false;
                        setTimeout(function() {algo.run(instrument);}, conf.algo.monitor_interval)
                    }
                } else {
                    algo.deploying = false;
                    setTimeout(function() {algo.run(instrument);}, conf.algo.monitor_interval)
                }
            }
        },

        deploy_straddle: function(instrument, atm_ce_pe) {
            algo.deploy_stats[instrument] = algo.deploy_stats[instrument] || {}      //Initialize empty object
            algo.deploy_stats[instrument].spot_value = atm_tracker.get_ltp(instrument); // Record the spot value

            //Deploy straddle
            atm_ce_pe.forEach(function (ce_pe_params) {
                orderbook.place_order(broker.order.get_algo_order_params(ce_pe_params, "S"))
                algo.deployed = true;
                algo.deploying = false;
                let selector = (`#at-pool tr[token=${ce_pe_params.token}][exch=${ce_pe_params.exch}][qty=${ce_pe_params.qty}][trtype='S']`)
                algo[ce_pe_params.optt + "-interval"] = setInterval(group_legs, conf.algo.monitor_interval, selector, ce_pe_params.optt)
            })

            function group_legs(row_sel, optt) {
                let row_id = $(row_sel).attr('id');
                console.log("Group legs : ", row_id)
                if(row_id != undefined) {
                    clearInterval(algo[optt + "-interval"])
                    if (optt == "CE") {
                        algo.deploy_stats[instrument].ce_leg = row_id;
                    } else if (optt == "PE") {
                        algo.deploy_stats[instrument].pe_leg = row_id;
                    }
                    $(row_sel).find('input:checkbox')[0].checked = true;

                    if (algo.deploy_stats[instrument].ce_leg != undefined
                        && algo.deploy_stats[instrument].pe_leg != undefined) {
                        algo.deploy_stats[instrument].deploy_count = algo.deploy_stats[instrument].deploy_count == undefined ? 1 : algo.deploy_stats[instrument].deploy_count + 1;
                        $('#group_name').val(algo.get_straddle_name(instrument, algo.deploy_stats[instrument].deploy_count))
                        algo.deploy_stats[instrument].group = util.grouping.group_selected();
                        let row_id = `summary-${algo.deploy_stats[instrument].group.id}`;
                        $(`#${row_id}`).attr('ttype', 'algo')
                        $(`#${row_id}`).attr('instrument', instrument)

                        algo.set_target(instrument);
                        algo.set_sl(instrument);
                        algo.monitor_straddle(instrument);
                    }
                }
            }
        },

        get_straddle_name : function(instrument, count) {
            return instrument.toUpperCase().replace('_', '') + '-STRADDLE-' + count
        },

        set_target : function(instrument) {
            let entry_price1 = parseFloat($(`#${algo.deploy_stats[instrument].ce_leg}`).find('.entry .price').text());
            let entry_price2 = parseFloat($(`#${algo.deploy_stats[instrument].pe_leg}`).find('.entry .price').text());
            let total_prem = entry_price1 + entry_price2;
            let target = (Math.round((total_prem * conf.algo.profit_pct * conf.algo[instrument].qty)/ 100)).toString();
            let row_id = `summary-${algo.deploy_stats[instrument].group.id}`;
            $(`#${row_id}`).find('.target').val(target)

            let ticker = broker.get_ticker({'token': 'algo-token', 'instrument_token': 'algo-instrument_token'})
            if(target != undefined && target != '' ) {
                milestone_manager.add_target(row_id, ticker, instrument + '_straddle', 'sell', milestone_manager.get_value_object(target))
            } else
                milestone_manager.remove_target(row_id)
        },

        set_sl : function(instrument) {
            let entry_price1 = parseFloat($(`#${algo.deploy_stats[instrument].ce_leg}`).find('.entry .price').text());
            let entry_price2 = parseFloat($(`#${algo.deploy_stats[instrument].pe_leg}`).find('.entry .price').text());
            let total_prem = entry_price1 + entry_price2;
            let sl = (-Math.round((total_prem * conf.algo.loss_pct * conf.algo[instrument].qty)/ 100)).toString();
            let row_id = `summary-${algo.deploy_stats[instrument].group.id}`;
            $(`#${row_id}`).find('.sl').val(sl)

            let ticker = broker.get_ticker({'token': 'algo-token', 'instrument_token': 'algo-instrument_token'})
            if(sl != undefined && sl != '' ) {
                milestone_manager.add_sl(row_id, ticker, instrument + '_straddle', 'sell', milestone_manager.get_value_object(sl))
            } else
                milestone_manager.remove_sl(row_id)
        },

        exit_cb : function(instrument) {
            algo.deployed = false
            console.log("Exit callback for algo called")

            let deploy_count = algo.deploy_stats[instrument].deploy_count
            algo.deploy_stats[instrument] = {}      //Initialize empty object
            algo.deploy_stats[instrument].deploy_count = deploy_count

            if(deploy_count < conf.algo.retry_count)
                algo.run(instrument);   //Re-deploy if the premiums of ATM strikes are close enough
        },

        monitor_straddle: function(instrument) {
            let cur_value = atm_tracker.get_ltp(instrument)
            let diff = Math.abs(cur_value - algo.deploy_stats[instrument].spot_value);
            if(diff > conf.algo[instrument].tolerate_deviation) {
                show_error_msg("Exiting "+ algo.deploy_stats[instrument].group.name +" as the spot moved beyond tolerable points of " + conf.algo[instrument].tolerate_deviation)
                //Close straddle
                let ce_leg_id = algo.deploy_stats[instrument].ce_leg;
                let pe_leg_id = algo.deploy_stats[instrument].pe_leg;
                $(`#${ce_leg_id}`).find('.exit').click()
                $(`#${pe_leg_id}`).find('.exit').click()

                // algo.exit_cb(instrument); //On click on exit button, exit order callback is called. That triggers algo.exit_cb(); So no need of calling it here
            } else {
                setTimeout(function(){algo.monitor_straddle(instrument)}, conf.algo.monitor_interval)
            }
        },
    }
    
    function update_ltp(selector, ltp) {
        $(selector).each(function(i, ltp_elm) {
            $(ltp_elm).text(ltp)

            if(selector.startsWith('#active_trade')) {
                $(ltp_elm).text(ltp)
                let tr_elm = $(ltp_elm).parent();
                if(tr_elm.attr('trade') == 'active') {
                    trade.update_pnl(tr_elm)
                    $("#active_trades_div").find('tbody').each(function(){
                        let group_id = $(this).attr('id')
                        trade.update_total_pnl(group_id)
                    })
                }
            } else if(selector.startsWith('#watch_list')) {
                let margin = parseInt($(ltp_elm).attr('lot_size')) * ltp
                if(!isNaN(margin))
                    $(ltp_elm).parent().find('.margin_req').text(margin.toFixed(0))
            }
        });
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
                update_ltp('#watch_list_body .watch_' + instr_token, ltp);   //In watch list
                update_ltp("#open_orders .open_order_" + instr_token, ltp)  // In Open Order table
                update_ltp("#active_trades_div tbody .trade_" + instr_token, ltp)  // In Active Trades table
                break;
        }
    }

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
                this.checked=false;
                let row_elm = $(this).parent().parent()
                row_elm.find('.buy').click()
            })

            if($('#watch_list_body input:checkbox:checked').length == 0) {
                let parent_checkbox = $('#watch_list_body').parent().find('thead input:checkbox')
                parent_checkbox[0].checked=false;
            }
        },

        sell_selected : function() {
            $('#watch_list_body input:checkbox:checked').each(function(){
                this.checked=false;
                let row_elm = $(this).parent().parent()
                row_elm.find('.sell').click()
            })

            if($('#watch_list_body input:checkbox:checked').length == 0) {
                let parent_checkbox = $('#watch_list_body').parent().find('thead input:checkbox')
                parent_checkbox[0].checked=false;
            }
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
                case "CANCELED": // Matching shoonya status
                    show_success_msg("Order " + order.norenordno + " cancelled. Symbol: " + order.tsym + " Qty: " + order.qty );
                    break;
                default:
                    console.log('Default order status : ')
                    console.log(JSON.stringify(order))
                    break;
            }
        },

        update_open_order_list : function(orders) {
            $('#open_order_list').html('')
            if(orders!=undefined && Array.isArray(orders))
                orders.forEach(function(order) {
                    orderbook.add_open_order(order)
                })
        },

        add_open_order : function(order) {
            if (order.status == "OPEN") {
                broker.subscribe_token(order.subscribe_token)

                let type = order.amo == "Yes"? "AMO ": "";
                let buy_sell = '';
                if (order.trantype == "B") {
                    buy_sell = '<span class="badge bg-success">' + type + 'Buy</span>'
                } else {
                    buy_sell = '<span class="badge bg-danger">' + type + 'Sell</span>'
                }
                let ttype = orderbook.know_bull_or_bear(order)

                let dname = (order.dname != undefined)? order.dname : order.tsym;
                ++unique_row_id;
                let row_id = "row_id_" + unique_row_id;
                $('#open_order_list').append(`<tr id="${row_id}" ordid="${order.norenordno}" exch="${order.exch}" tsym="${order.tsym}" 
                                    qty="${order.qty}" token="${order.token}" ttype="${ttype}" trtype="${order.trantype}" variety="${order.variety}"">
                        <td>${buy_sell}</td>
                        <td class="order-num">${order.norenordno}</td>
                        <td>${dname}</td>
                        <th class="open_order_${order.token} ltp"></th>
                        <td><input type="text" class="form-control entry" placeholder=""  value="${order.prc}"></td>
                        <td><input type="text" class="form-control target" placeholder=""  value=""></td>
                        <td><input type="text" class="form-control sl" placeholder=""  value=""></td>
                        <td><input type="text" class="form-control qty" placeholder=""  value="${order.qty}"></td>
    
                        <td><button type="button" class="btn btn-success modify" onclick="client_api.orderbook.modify_order(this)">Modify</button></td>
                        <td><button type="button" class="btn btn-danger cancel" onclick="client_api.orderbook.cancel_order(this)">Cancel</button></td>
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

            let params = broker.order.get_order_params(tr_elm, buy_sell, entry_obj, qty)
            let algo = tr_elm.attr('algo')
            if (entry_obj.spot_based) {
                params.dname = tr_elm.attr('dname')
                if(broker.name != "shoonya")
                    params = broker.order.map_order(params)
                this.add_to_spot_order_list(params, entry_val)
            } else {
                this.place_order(params, success_cb)
            }

            setTimeout(function() {
                tr_elm.find('.buy').removeAttr('disabled');
                tr_elm.find('.sell').removeAttr('disabled');
            }, 500)
        },

        place_order : function(params, success_cb) {
            console.log("Going to place order " + JSON.stringify(params))
            if(!is_paper_trade()) {
                broker.order.place_order(params, function (data) {
                    if (success_cb != undefined) {  // Call custom function provided.. In case of exit, it needs to remove tr
                        console.log("Success call back is provided. Will be called")
                        success_cb(data)
                    } else { // No custom function provided. Default actions
                        console.log("Default place order call back called")
                        orderbook.place_order_cb_carry_target_sl_to_active_trade(data)
                    }
                })
            } else {
                orderbook.place_paper_trade(params, live_data[params['token']])
            }
        },

        add_to_spot_order_list : function(item, entry_val) {
            let buy_sell = '';
            if (item.trantype === "B") {
                buy_sell = '<span class="badge bg-success">Buy</span>'
            } else {
                buy_sell = '<span class="badge bg-danger">Sell</span>'
            }

            let ttype = this.know_bull_or_bear(item)

            let dname = (item.dname != undefined)? item.dname : item.tsym;
            let row_id = `row_id_${++unique_row_id}`
            $('#spot_order_list').append(`<tr id="${row_id}" ordid="${item.norenordno}" exch="${item.exch}" tsym="${item.tsym}" dname="${item.dname}"  qty="${item.qty}" token="${item.token}" instrument_token="${item.instrument_token}" ttype="${ttype}" trtype="${item.trantype}">
                    <td>${buy_sell}</td>
                    <td class="order-num">Spot Based Entry</td>
                    <td>${dname}</td>
                    <th class="open_order_${item.token} ltp"></th>
                    <td><input type="text" class="form-control entry" placeholder=""  value="${entry_val}"></td>
                    <td><input type="text" class="form-control target" placeholder=""  value=""></td>
                    <td><input type="text" class="form-control sl" placeholder=""  value=""></td>
                    <td><input type="text" class="form-control qty" placeholder=""  value="${item.qty}"></td>

                    <td><button type="button" class="btn btn-success modify" onclick="client_api.orderbook.modify_order(this)">Modify</button></td>
                    <td><button type="button" class="btn btn-danger cancel" onclick="client_api.orderbook.cancel_order(this)">Cancel</button></td>
            </tr>`);

            let ticker = broker.get_ticker({'token' : item.token, 'instrument_token': item.instrument_token})
            let entry_obj = milestone_manager.get_value_object(entry_val)
            if(entry_obj.spot_based)
                milestone_manager.add_entry(row_id, ticker, ttype, item.trantype, entry_obj);
        },

        update_open_orders : function() {
            hide_other_tabs('#open_orders')
            broker.order.get_orderbook(function(data) {orderbook.update_open_order_list(data);})
        },

        cancel_order : function(td_elm) {
            let tr_elm = $(td_elm).parent().parent();
            let orderno = tr_elm.find('.order-num').html()
            let row_id = tr_elm.attr('id')

            if(orderno.includes('Spot')) {  // Spot based entry
                milestone_manager.remove_milestone(row_id);
                tr_elm.remove();
            } else {
                broker.order.cancel_order(tr_elm, orderno, function(orders) {
                    let matching_order = orders.find(order => order.norenordno === orderno)
                    if (matching_order != undefined) {
                        orderbook.display_order_exec_msg(matching_order);
                    }
                    orderbook.update_open_order_list(orders);
                })
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
            let instrument_token = tr_elm.attr('instrument_token')

            let target_value = tr_elm.find('.target').val()

            let ticker = broker.get_ticker({'token': token, 'instrument_token': instrument_token})

            if(target_value == undefined || target_value == '') {
                milestone_manager.remove_target(row_id);
            } else { // Target has some value
                let target_obj = milestone_manager.get_value_object(target_value)
                milestone_manager.add_target(row_id, ticker, ttype, trtype, target_obj);
            }

            let sl_value = tr_elm.find('.sl').val()

            if(sl_value == undefined || sl_value == '') {
                milestone_manager.remove_sl(row_id);
            } else {  // SL has some value
                let sl_obj = milestone_manager.get_value_object(sl_value)
                milestone_manager.add_sl(row_id, ticker, ttype, trtype, sl_obj);
            }

            let entry_obj = milestone_manager.get_value_object(entry_value)
            if(entry_obj.spot_based && entry_obj.value != '') {  // Spot based entry
                milestone_manager.add_entry(row_id, ticker, ttype, trtype, entry_obj)
            } else {
                milestone_manager.remove_entry(row_id); // Entry should be present in milestone_mgr only if it is spot based. Else LIMIT & MKT order should be placed immediately

                if(!order_id.includes("Spot")) {  // Modify value order.. Not spot based order

                    broker.order.modify_order(tr_elm, entry_obj, function(data) {
                        let monitored = open_order_mgr.add_modify(data.orderno)

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
            order.exch = (order.exch === undefined)? order.exchange : order.exch
            order.trantype = (order.trantype === undefined)? (order.transaction_type=="BUY"? "B": "S") : order.trantype
            order.qty = (order.qty === undefined)? order.quantity : order.qty
            order.remarks = (order.remarks === undefined)? order.tag : order.remarks
            order.tsym = (order.tsym === undefined)? order.tradingsymbol : order.tsym

            ++unique_row_id;
            let row_id = "row_id_" + unique_row_id;
            milestone_manager.add_order_id(row_id, order_id);

            let target = '';
            let sl = '';
            trade.display_active_trade(order, target, sl, true, row_id);
        },

        //TODO - Partial quantity exit should be done
        exit_order : function(td_elm) {
            let tr_elm = $(td_elm).parent().parent();
            let to_be_closed_order_id = tr_elm.attr('ordid')
            let limit_value = tr_elm.find('.exit-limit').val()
            let qty = tr_elm.find('.qty').val()

            let buy_sell= tr_elm.attr('trtype') == 'B' ? 'S' : 'B'; // Do the opposite
            let exit_limit = milestone_manager.get_value_object(limit_value);
            let values = broker.order.get_order_params(tr_elm, buy_sell, exit_limit, qty)

            if(!is_paper_trade()) {
                broker.order.exit_order(values, function (data) {
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
                values.remarks = values.remarks == undefined? values.tag : values.remarks
                orderbook.exit_order_cb(values, null, tr_elm);
            }
        },

        exit_order_cb: function(matching_order, orders, tr_elm){
            console.log("Exit order complete cb : "+ matching_order.norenordno)
            // console.log(open_order_mgr.open_orders[matching_order.norenordno])
            console.log(matching_order)

            milestone_manager.remove_milestone(tr_elm.attr('id'));
            tr_elm.removeClass('table-danger'); //For bearish trade, this class is present.. needs to be removed in order to turn it into gray
            tr_elm.addClass('table-secondary');
            tr_elm.attr('trade', 'closed');
            let td_elm = tr_elm.find('.exit-limit').parent();
            // let remarks = matching_order.remarks.substring(0, matching_order.remarks.indexOf(" Vix"));
            let remarks = matching_order.remarks;
            td_elm.html(`<span class="badge badge-pill bg-dark">${matching_order.norentm.split(" ")[0]}</span>
                                    </br><span class="badge bg-primary">${remarks}</span>
                                    </br><span class="price exit-price">${matching_order.avgprc}</span>
                                `);
            trade.update_pnl(tr_elm, matching_order.avgprc)
            let group_id = tr_elm.parent().attr('id')
            trade.update_total_pnl(group_id)

            tr_elm.find('.modify').parent().html(`CLOSED</br><span class="badge badge-pill bg-secondary" title="Watch live" onclick="client_api.trade.toggle_watch_closed_trade($(this))" style="cursor:pointer;padding:8px;margin-top:10px">Watch</span>`);
            tr_elm.find('.exit').parent().html(`<button type="button" class="btn btn-dark btn-sm delete" onclick="client_api.trade.delete(this)">Delete</button>`);
            tr_elm.find('.qty').attr('disabled', 'disabled');
            tr_elm.find('.exit').attr('disabled', 'disabled');

            if(orders) { // In case of paper trade, orders will be null and the below code will not execute
                orderbook.update_open_order_list(orders);
            }

            //Remove SL and Target set on Total row, if there are no active trades
            if($(`#${group_id} tr[trade="active"]`).length < 1) {
                let summary_row_id = `summary-${group_id}`;
                milestone_manager.remove_milestone(summary_row_id);
                $(`#${summary_row_id} th input.target, #${summary_row_id} th input.sl`).val("")  //Reset UI
                if($(`#${summary_row_id}`).attr('ttype')==='algo') {
                    algo.exit_cb($(`#${summary_row_id}`).attr('instrument'));
                }
            }
        },

        get_order_status(orderno, action, oncomplete_cb) {

            if(open_order_mgr.exec_permission(orderno, action)) {
                console.log(action + ": get_order_status : " + orderno + " Making get_orderbook post req")
                broker.order.get_orderbook(function (orders) {
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
            broker.order.get_orderbook(function(orders) {
                if(orders!=undefined && Array.isArray(orders))
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
                buy_sell = '<span class="badge bg-success">' + type + 'Buy</span>'
            } else {
                buy_sell = '<span class="badge bg-danger">' + type + 'Sell</span>'
            }
            let prd = this.get_prod_name(item.prd);

            let status = item.status;
            if (item.status == "OPEN")
                status = '<button class="btn btn-warning"> OPEN </button>'

            let dname = (item.dname != undefined)? item.dname : item.tsym;
            let rej_reason = (item.rejreason != undefined)? item.rejreason : "";
            let ticker = broker.get_ticker(item)
            $('#order_book_table').append(`<tr>
                        <td class="order-num">${item.norenordno}</td>
                        <td>${status}</td>
                        <td>${dname}</td>
                        <td>${item.qty}</td>
                        <td>${buy_sell}</td>
                        <td>${item.avgprc === undefined? item.prc : item.avgprc}</td>
                        <td>${item.prctyp}</td>
                        <td>${item.norentm === undefined? "": item.norentm}</td>
                        <td>${rej_reason}</td>
                        <td>${item.remarks === undefined? "" : item.remarks}</td>
                        <td>${item.exch_tm === undefined? "": item.exch_tm}</td>
                        <td>${item.exch}</td>
                        <td>${prd}</td>
                        <td>${ticker}</td>
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
                        else if(order.trantype === "S") trade_type = "bull"
                    }
                    else if (dname.endsWith("CE")) {
                        if(order.trantype === "B") trade_type = "bull"
                        else if(order.trantype === "S") trade_type = "bear"
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

        reset_max_profit_loss : function(group_id) {
            $('#ms-profit-' + group_id).text('')
            $('#ms-loss-' + group_id).text('')
            $('#pnl-' + group_id).text('')
            let row_id='summary-' + group_id;
            this.max_profit_seen[row_id] = 0
            this.max_loss_seen[row_id] = 0
        },

        delete: function(del_btn) {
            let row_elm = $(del_btn).parent().parent();
            let tbody = row_elm.parent();
            let group_id = tbody.attr('id')
            row_elm.remove();

            trade.reset_max_profit_loss(group_id);
            if(tbody.children().length === 0) { //Remove group if no position is left in the group
                tbody.parent().find('thead input:checkbox')[0].checked = false; //uncheck parent checkbox
                if(!group_id.includes('at-pool')) //Do not remove the pool
                    tbody.parent().parent().remove(); //Remove the div
            }
        },

        update_total_pnl : function(group_id) {
            let total = 0

            let rows = $(`#${group_id}`).find('tr')
            rows.each(function () {
                let pnl = $(this).find('td.pnl').text().trim()
                total += parseFloat(pnl)
            })

            if (!isNaN(total)) {
                let total_pnl_elm = $('#pnl-' + group_id)
                const row_id = 'summary-' + group_id;
                if (total < 0) {
                    total_pnl_elm.css('color', 'red')
                } else {
                    total_pnl_elm.css('color', 'green')
                }
                let ret = this.get_max_profit_loss(row_id, total);
                total_pnl_elm.text(total.toFixed(2))
                $('#ms-profit-' + group_id).text(ret['profit'].toFixed(2))
                $('#ms-loss-' + group_id).text(ret['loss'].toFixed(2))
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
                elm.removeClass('bg-secondary')
                elm.addClass('bg-success')
                let tr_elm = elm.parent().parent()
                tr_elm.attr('trade', 'active')
                elm.text("Stop")
                elm.attr('title', "Stop live watching")
            } else {
                elm.removeClass('bg-success')
                elm.addClass('bg-secondary')
                let tr_elm = elm.parent().parent()
                tr_elm.attr('trade', 'closed')
                elm.text("Watch")
                elm.attr('title', "Watch live")
                show_success_msg("Resetting the P&L")
                setTimeout(function() {
                    trade.update_pnl(tr_elm, tr_elm.find('.exit-price').text())
                    let group_id = tr_elm.parent().attr('id')
                    trade.update_total_pnl(group_id)
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

            setTimeout(trade.trigger, conf.target_sl_check_interval)

            function check_entry_trigger(row_id, mile_stone) {
                let cur_value = 0;
                let entry_obj = mile_stone.get_entry();
                let trig_value = parseFloat(entry_obj.value);
                let ttype = mile_stone.ttype;
                let buy_sell = mile_stone.buy_sell;
                if (entry_obj.spot_based) {
                    switch(entry_obj.instrument) {
                        case "nifty" : cur_value = live_data[nifty_tk]; break;
                        case "bank_nifty" : cur_value = live_data[bank_nifty_tk]; break;
                        case "fin_nifty" : cur_value = live_data[fin_nifty_tk]; break;
                        default : console.error(row_id + " Spot based entry.. neither nifty, nor bank-nifty, not even fin-nifty " + mile_stone); break;
                    }
                }
                console.log(`Checking Entry : ${ttype}  current : ${cur_value}  trig : ${trig_value}`)

                //Only spot based entry should be checked. If it is price based then limit order will be placed
                if(entry_obj.spot_based) {
                    if (ttype === 'bull') {
                        if (cur_value <= trig_value) {
                            entry_triggered()
                        }
                    } else if (ttype === 'bear') {
                        if (cur_value >= trig_value) {
                            entry_triggered()
                        }
                    }
                }

                function entry_triggered() {

                    if(milestone_manager.entry_exists(row_id)) {  // To avoid duplicate execution
                        show_success_msg("Entry triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_value)
                        console.log("Entry triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_value)
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
                    if(row_id.startsWith("summary-")) { // Use total P & L value in case of cumulative target and SL
                        cur_spot_value = $(`#${row_id}`).find('.pnl').text()
                        if(cur_spot_value!=undefined)
                            cur_spot_value = parseFloat(cur_spot_value)
                    }
                    else {
                        // cur_spot_value = live_data[mile_stone.token]; //Check for LTP of the instrument
                        let pnl = $(`#${row_id}`).find('.pnl').text()
                        cur_spot_value = parseFloat(pnl)
                    }
                }

                // console.log(`Checking Target : ${ttype}  current : ${cur_spot_value}  trig : ${trig_value}`)

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
                    // if(row_id.startsWith("summary-")) {
                    if (cur_spot_value >= trig_value) {
                        target_triggered()
                    }
                    // }
                    /*
                    // Instrument LTP based checking
                    if (buy_sell === 'B') {
                        if(cur_spot_value >= trig_value) {
                            target_triggered()
                        }
                    } else if (buy_sell === 'S') {
                        if(cur_spot_value <= trig_value) {
                            target_triggered()
                        }
                    }*/
                }

                function target_triggered() {
                    let msg, group_name='';

                    if(row_id.startsWith("summary-")){
                        let group_id = row_id.replace('summary-', '')
                        group_name = row_id.replace('summary-at-', '').toUpperCase()
                        let group_selector = '#' + group_id;
                        util.grouping.exit_group(group_selector, true)
                    }
                    else {
                        let tr_elm = $(`#${row_id}`)
                        tr_elm.find('.exit').click();
                    }
                    let name = (group_name=='')? "row: "+row_id : "group: " + group_name
                    msg = "Target triggered for " + name + " Trigger value = " + trig_value + " Current value = " + cur_spot_value
                    show_success_msg(msg)
                    console.log(msg)
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
                    if (row_id.startsWith("summary-")) { // Use total P & L value in case of cumulative target and SL
                        cur_spot_value = $('#' + row_id).find('.pnl').text()
                        if (cur_spot_value != undefined)
                            cur_spot_value = parseFloat(cur_spot_value)
                    } else {
                        // cur_spot_value = live_data[mile_stone.token];  //Check for LTP of the instrument
                        let pnl = $(`#${row_id}`).find('.pnl').text()
                        cur_spot_value = parseFloat(pnl)
                    }
                }

                // console.log(`Checking SL : ${ttype}  current : ${cur_spot_value}  trig : ${trig_value}`)
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
                    // if(row_id.startsWith("summary-")) {
                    if (cur_spot_value <= trig_value) {
                        sl_triggered()
                    }
                    /*} else {      // Instrument LTP based checking has to be this way
                        if (buy_sell === 'B') {
                            if (cur_spot_value <= trig_value) {
                                sl_triggered()
                            }
                        } else if (buy_sell === 'S') {
                            if (cur_spot_value >= trig_value) {
                                sl_triggered()
                            }
                        }
                    }*/
                }

                function sl_triggered() {
                    let msg, group_name='';

                    if(row_id.startsWith("summary-")) {
                        let group_id = row_id.replace('summary-', '')
                        group_name = row_id.replace('summary-at-', '').toUpperCase()
                        let group_selector = '#' + group_id;
                        util.grouping.exit_group(group_selector, true)
                    }
                    else {
                        let tr_elm = $(`#${row_id}`)
                        tr_elm.find('.exit').click();
                    }
                    let name = (group_name=='')? "row: "+row_id : "group: " + group_name
                    msg = "SL triggered for " + name + " Trigger value = " + trig_value + " Current value = " + cur_spot_value
                    show_error_msg(msg)
                    console.log(msg)

                    milestone_manager.remove_milestone(row_id)
                }
            }
        },

        close_all_trades: function () {
            if($('#active_trades_div tbody tr[trtype="S"]').length > 0) {
                //Exit all sell positions first
                $('#active_trades_div tbody tr[trtype="S"]').each(function (index, tr_elm) {
                    $(tr_elm).find('.exit').click()
                })
                //Then exit the buy positions
                setTimeout(function () {
                    $('#active_trades_div tbody tr[trtype="B"]').each(function (index, tr_elm) {
                        $(tr_elm).find('.exit').click()
                    })
                }, 500)
            } else {
                $('#active_trades_div tbody tr').each(function (index, tr_elm) {
                    $(tr_elm).find('.exit').click()
                })
            }

            $('#active_trades_div tfoot tr').each(function(index, tr_elm) {
                milestone_manager.remove_milestone($(tr_elm).attr('id'));
            })
        },

        display_active_trade : function(order, target, sl, paper_trade=false, row_id) {
            let ttype = orderbook.know_bull_or_bear(order)
            let buy_sell = '';
            let paper_tag = paper_trade?"Paper ":""
            if (order.trantype == "B") {
                buy_sell = `<span class="badge bg-success"> ${paper_tag} Buy</span>`
            } else {
                buy_sell = `<span class="badge bg-danger"> ${paper_tag} Sell</span>`
            }
            let dname = (order.dname != undefined)? order.dname : order.tsym;

            console.log("Active trade : " + JSON.stringify(order))
            if(row_id == undefined) {
                row_id = "row_id_" + ++unique_row_id;
            }

            let ticker = broker.get_ticker(order)
            let className= "";//(ttype==="bear")?"table-danger":" ";

            let tbody_elm = $('#at-pool');
            // let remarks = order.remarks.substring(0, order.remarks.indexOf(" Vix"));
            let remarks = order.remarks;

            tbody_elm.append(`<tr id="${row_id}" class="${className}" ordid="${order.norenordno}"  exch="${order.exch}" token="${order.token}" instrument_token="${order.instrument_token}" qty="${order.qty}" tsym="${order.tsym}" ttype="${ttype}" trtype="${order.trantype}" trade="active">
                        <td> <input type="checkbox" class="select_box" value="" onclick="client_api.util.uncheck(this)"> </td>
                        <td>${buy_sell}</td>
                        <td class="instrument">${dname}</td>
                        <td class="entry num" title="Margin Used : ${(order.prc * order.qty).toFixed(2)}">
                            <span class="badge badge-pill bg-dark">${order.norentm.split(" ")[0]}</span>
                            </br><span class="badge bg-primary">${remarks}</span>
                            </br><span class="price">${order.prc}</span>
                        </td>
                        <td class="trade_${ticker} ltp">${live_data[ticker]}</td>
                        <td class="pnl"></td>
                        <td><input type="text" disabled class="form-control target" placeholder="" value=""></td>
                        <td><input type="text" disabled class="form-control sl" placeholder="" value="" ></td>
                        <td><input type="text" class="form-control exit-limit" placeholder="" ></td>
                        <td><input type="text" class="form-control qty" placeholder=""  value="${order.qty}"></td>
                        <td><button type="button" class="btn btn-success modify" onclick="client_api.trade.modify(this, $(this).text())">Edit</button></td>
                        <td><button type="button" class="btn btn-danger exit" onclick="client_api.trade.exit(this)">Exit</button></td>
                </tr>`);

            if(target != undefined && target != '' ) {
                milestone_manager.add_target(row_id, ticker, ttype, order.trantype, milestone_manager.get_value_object(target))
                $('#' + row_id).find('.target').val(target)
            }
            if(sl != undefined && sl != '' ) {
                milestone_manager.add_sl(row_id, ticker, ttype, order.trantype, milestone_manager.get_value_object(sl))
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

                    $('#at-pool .max-profit-loss').html( (credit_spread?"Credit Spread": "Debit Spread") + "<br>Max profit = " + max_profit.toFixed(1) + "</br> Max loss = " + max_loss.toFixed(1) + "</br> Break-even=" + break_even.toFixed(0))
                }
            } else {
                $('#at-pool .max-profit-loss').html("")
            }
        },

        calculate_spreads : function() {
            let tbody_elm = $('#at-pool')

            trade.fill_in_max_profit_loss_for_debit_spread(tbody_elm)
            setTimeout(trade.calculate_spreads, 1000);
        },

        getCounterTradePosition : function(open_ord_tr_elm) {
            let token;
            if(broker.name === "shoonya")
                token = open_ord_tr_elm.attr('token')
            else if(broker.name === "kite")
                token = open_ord_tr_elm.attr('instrument_token')
            let qty=open_ord_tr_elm.attr('qty')
            let counter_trtype=open_ord_tr_elm.attr('trtype') === 'B'? 'S': 'B'
            let exch=open_ord_tr_elm.attr('exch')

            console.log("Trying to find counter position : " + exch + "|" + token + " - " + qty + " trtype = " + counter_trtype);

            return this.getTradePosition(token, exch, counter_trtype, qty);
        },

        getTradePosition : function(token, exch, trtype, qty) {
            let position;
            if(broker.name === "shoonya")
                position = $(`#at-pool tr[token=${token}][exch=${exch}][qty=${qty}][trtype=${trtype}]`)
            else if(broker.name === "kite")
                position = $(`#at-pool tr[instrument_token=${token}][exch=${exch}][qty=${qty}][trtype=${trtype}]`)
            return position;
        },

        select_trade_type : function(select_opt, tr_elm) {
            let ttype = select_opt.value
            tr_elm.attr('ttype', ttype)
        },

        modify : function(elm, button_text, summary_row=false) {
            let tr_elm = $(elm).parent().parent();

            if(button_text === 'Edit') {
                tr_elm.find('.target').removeAttr('disabled')
                tr_elm.find('.sl').removeAttr('disabled')
                $(elm).text('Done')
                if(summary_row)
                    tr_elm.find('.form-select').removeAttr('disabled')

            } else {
                tr_elm.find('.target').attr('disabled', 'disabled')
                tr_elm.find('.sl').attr('disabled', 'disabled')
                $(elm).text('Edit')
                if(summary_row)
                    tr_elm.find('.form-select').attr('disabled', 'disabled')

                let ordid = tr_elm.attr('ordid');
                let ttype = tr_elm.attr('ttype');
                let target = tr_elm.find('.target').val();
                let sl = tr_elm.find('.sl').val();

                let row_id = tr_elm.attr('id')
                let token = tr_elm.attr('token')
                let instrument_token = tr_elm.attr('instrument_token')
                let trtype = tr_elm.attr('trtype')

                let ticker = broker.get_ticker({'token': token, 'instrument_token': instrument_token})
                if(target != undefined && target != '' ) {
                    milestone_manager.add_target(row_id, ticker, ttype, trtype, milestone_manager.get_value_object(target))
                } else
                    milestone_manager.remove_target(row_id)

                if(sl != undefined && sl != '' ) {
                    milestone_manager.add_sl(row_id, ticker, ttype, trtype, milestone_manager.get_value_object(sl))
                } else
                    milestone_manager.remove_sl(row_id)
            }
        },

        exit : function(elm) {
            client_api.orderbook.exit_order(elm);
        },

        load_open_positions : function() {
            if(!is_paper_trade()) {
                broker.position.get_positions(function (positions) {
                    if (positions != undefined && positions.stat !== 'Not_Ok')
                        positions.forEach((position) => {
                            broker.subscribe_token(broker.get_subscribe_token(position));
                            trade.display_trade_position(position)
                        })
                })
            }
        },

        display_trade_position : function(pos) {
            if (pos.stat.toUpperCase() === "OK") {
                let buy_sell = '', trtype='';
                let qty = pos.netqty;
                if (qty > 0) {
                    buy_sell = '<span class="badge bg-success">Buy</span>'
                    trtype='B'
                } else {
                    buy_sell = '<span class="badge bg-danger">Sell</span>'
                    trtype='S'
                }
                pos.transtype = trtype;
                let ttype = orderbook.know_bull_or_bear(pos)
                qty = (qty < 0)? -1 * qty:qty; // Make it positive if it is negative
                let dname = (pos.dname != undefined) ? pos.dname : pos.tsym;

                if(qty >0) {
                    console.log("Open position : ", JSON.stringify(pos))

                    let ticker = broker.get_ticker(pos)
                    let position = trade.getTradePosition(ticker, pos.exch, trtype, qty);
                    if(position.length == 0) { //Add new position only if it doesn't exist
                        console.log("Position doesn't exist in active trades. So adding it..")
                        $('#at-pool').append(`<tr id="row_id_${++unique_row_id}" exch="${pos.exch}" token="${ticker}" instrument_token="${ticker}" tsym="${pos.tsym}" qty="${qty}" ttype="${ttype}" trtype="${trtype}" trade="active">
                            <td> <input type="checkbox" class="select_box" value="" onclick="client_api.util.uncheck(this)"> </td>
                            <td>${buy_sell}</td>
                            <td>${dname}</td>
                            <td class="entry num">
                                <span class="price">${pos.netavgprc}</span>
                            </td>
                            <td class="trade_${ticker} ltp">${pos.lp}</td>
                            <td class="pnl"></td>
                            <td><input type="text" disabled class="form-control target" placeholder="" ></td>
                            <td><input type="text" disabled class="form-control sl" placeholder="" ></td>
                            <td><input type="text" class="form-control exit-limit" placeholder="" ></td>
                            <td><input type="text" class="form-control qty" placeholder=""  value="${qty}"></td>
                            <td><button type="button" class="btn btn-success modify" onclick="client_api.trade.modify(this, $(this).text())">Edit</button></td>
                            <td><button type="button" class="btn btn-danger exit" onclick="client_api.trade.exit(this)">Exit</button></td>
                        </tr>`);
                        /*${live_data[ticker]}*/
                    }else {
                        console.log("Position is already present in active trades")
                    }
                }
            }
        },

        exit_all_positions : function() {
            conf.algo.retry_count = 0;  //To make sure that algo doesn't place new trade
            if(!is_paper_trade()) {
                $('#open_orders tr').each(function (index, tr_elm) {
                    $(tr_elm).find('.cancel').click()
                })
            }

            trade.close_all_trades()
            console.log("Switching off algo. Page needs to be refreshed before placing new algo");
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
                    client_api.watch_list.add_row_to_watch(JSON.parse(value_str))
                }
            }
        },

        delete : function() {
            let count = 0;
            let $tbody = $("#watch_list_body")
            $tbody.find('tr input:checkbox:checked').each(function() {
                let row_elm = $(this).parent().parent()
                row_elm.find('.delete').click();
                ++count;
            })

            if(count == 0) show_error_msg("No instrument is selected")

            if($tbody.children().length === 0) {
                $tbody.parent().find('thead input:checkbox')[0].checked = false; //uncheck parent checkbox
            }
        },

        add_to_watchlist : function() {
            if(this.selection_is_valid()) {
                let params = {}
                params.sym = $('input.watch_item').val()
                params.instrument_token = $('input.watch_item').attr('instrument_token')
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
            if(name == "")
                return false
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

        add_row_to_watch : function(params) {
            let sym_token = broker.get_subscribe_token(params);

            console.log("Add row to watch .. ", sym_token)
            broker.subscribe_token(sym_token);

            //Add to watched items
            watch_list.watched_items[`${params.exch}_${params.token}`] = JSON.stringify(params)
            // watch_list.save_watch_list()

            let class_name = ''
            if(params.put_option) {
                class_name = 'table-danger'
            }

            let ticker = broker.get_ticker(params);

            $('#watch_list_body').append(`<tr class="${class_name}" ${params.algo?'algo':''} exch="${params.exch}" token="${params.token}" instrument_token="${params.instrument_token}" tsym="${params.tsym}" lot_size="${params.lot_size}" dname="${params.dname}">
    
                <td> <input type="checkbox" class="select_box" value="" onclick="client_api.util.uncheck(this)"> </td>
                <td class="dname">${params.dname}</td>
                <td class="margin_req num"></td>
                <td class="watch_${ticker} ltp" lot_size="${params.lot_size}"></td>
                <td class="input_box"><input type="text" class="form-control entry" placeholder="" onclick="client_api.watch_list.add_ltp(this); $(this).unbind('click');"></td>  
                <td class="input_box"><input type="text" class="form-control qty" placeholder="" value="${params.lot_size}"></td>
                <td><button type="button" class="btn btn-success buy" onclick="client_api.orderbook.buy(this)">BUY</button></td>
                <td><button type="button" class="btn btn-danger sell" onclick="client_api.orderbook.sell(this)">SELL</button></td>
                <td class="del-icon delete" onclick="client_api.watch_list.delete_item(this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </td>
               </tr>`);

            return `#watch_list_body tr[token=${params.token}]`;   //Class identifier for the row added
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
            // watch_list.save_watch_list()

            tr_elm.remove();
        },
    };

    const positions = {

        show_positions : function() {
            $('#positions_table').html("")
            hide_other_tabs('#positions')
            broker.position.get_positions(function(positions) {
                let pnl = {unrealized_pnl : 0.0, realized_pnl:0.0 };
                if (positions != undefined && positions.stat !== 'Not_Ok')
                    positions.forEach((position)=> client_api.positions.show_position(position, pnl))

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

                let ticker = broker.get_ticker(item)

                $('#positions_table').append(`<tr class="${cls}" exch="${item.exch}" token="${item.token}" tsym="${item.tsym}" lot_size="${item.ls}">
                        <td class="text">${dname}</td>
                        <td class="num">${urmtm}</td>
                        <td class="num">${rpnl}</td>
                        <td>${item.daybuyavgprc}</td>
                        <td>${item.daysellavgprc}</td>
                        <td>${item.daybuyqty}</td>
                        <td>${item.daysellqty}</td>
                        <td class="pos_${ticker} num ltp">${item.lp}</td>
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

    const util = {
        select_all : function(chk_elm, selector) {
            $(selector).each(function() {
                if(chk_elm.checked)
                    this.checked = true
                else
                    this.checked = false
            })
        },

        uncheck : function(chk_elm) {
            if(!chk_elm.checked) {
                let $table_elm = $(chk_elm).parent().parent().parent().parent()
                let parent_checkbox = $table_elm.find('thead input:checkbox')
                parent_checkbox[0].checked = false;
            } else {
                let $tbody_elm = $(chk_elm).parent().parent().parent()
                if($tbody_elm.find('input:checkbox:not(:checked)').length == 0) {
                    let parent_checkbox = $tbody_elm.parent().find('thead input:checkbox')
                    parent_checkbox[0].checked = true;
                }
            }
        },

        grouping : {
            unique_group_id: 0,
            class_names : ['table-light', 'table-success'],

            generate_group_id : function(group_name) {
                let uname;
                if(group_name === "")
                    uname = group_name = "group-" + (++this.unique_group_id);
                else {
                    group_name = group_name.replace(/[^\w]/gi, '-'); //Remove all special characters
                    uname = group_name + "-" + (++this.unique_group_id);
                }

                let gid = "at-" + uname;
                return {'name' : group_name, 'id': gid}
            },

            group_selected: function () {
                if( $('#at-pool input:checkbox:checked').length > 0) {
                    let class_name = this.class_names[this.unique_group_id % this.class_names.length];
                    let group_name = $('#group_name').val().trim()

                    let group = this.generate_group_id(group_name);

                    this.create_table(group, class_name)
                    let tbody_elm = $(`#${group.id}`);

                    $('#at-pool input:checkbox:checked').each(function () {
                        let row_elm = $(this).parent().parent()
                        this.checked = false;
                        let cl_row = row_elm.clone()
                        tbody_elm.append(cl_row)
                        row_elm.remove()
                    })

                    if($('#at-pool').children().length === 0) {
                        let parent_checkbox = $('#at-pool').parent().find('thead input:checkbox');
                        parent_checkbox[0].checked = false;
                        trade.reset_max_profit_loss('at-pool');
                    }

                    $('#group_name').val(''); //Reset group name
                    return group
                } else {
                    show_error_msg("No position is selected")
                }
            },

            ungroup_selected: function (tbody_selector) {
                if($(`${tbody_selector} input:checkbox:checked`).length > 0) {
                    $(`${tbody_selector} input:checkbox:checked`).each(function () {
                        let row_elm = $(this).parent().parent()
                        this.checked = false;
                        let cl_row = row_elm.clone()
                        $('#at-pool').append(cl_row)
                        row_elm.remove()
                    })
                    $(tbody_selector).parent().find('thead input:checkbox')[0].checked = false; //uncheck parent checkbox
                    if($(tbody_selector).children().length === 0) { //Remove group if no position is left in the group
                        $(tbody_selector).parent().parent().remove(); //Remove the div
                    }
                } else {
                    show_error_msg("No position is selected")
                }
            },

            delete : function(tbody_selector) {
                $(tbody_selector).find('tr .delete').click();
                if($(tbody_selector).children().length === 0) { //Remove group if no position is left in the group
                    $(tbody_selector).parent().find('thead input:checkbox')[0].checked = false; //uncheck parent checkbox
                    if(!tbody_selector.includes('at-pool')) //Do not remove the pool
                        $(tbody_selector).parent().parent().remove(); //Remove the div
                }
            },

            exit_group : function(group_selector, target_sl_triggered=false) {
                let count = 0;
                $(group_selector).find('tr[trtype="S"]').each(function(){close(this);})
                $(group_selector).find('tr[trtype="B"]').each(function(){close(this);})

                if(count == 0)
                    show_error_msg("No position selected to exit")

                function close(row) {
                    let checkbox = $(row).find('.select_box')[0];
                    if(checkbox.checked || target_sl_triggered) {
                        count++;
                        $(row).find('.exit').click();
                    }
                }
            },

            create_table : function(group, class_name) {
                $('#active_trades_div').append(`<div group="${group.id}">
                    <div>
                        <button class="btn btn-secondary mb-3" onclick="client_api.util.grouping.ungroup_selected('#${group.id}')">Ungroup Selected</button>
                        <button class="btn btn-danger mb-3" onclick="client_api.util.grouping.exit_group('#${group.id}')">Exit</button>
                        <span class="del-icon" onclick="client_api.util.grouping.delete('#${group.id}')" title="Delete the closed trades" style="position: relative; top:-7px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="32" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                        </span>
                        <h5 style="float:right;">${group.name.toUpperCase()}</h5>
                    </div>
                    <table  class="table ${class_name} table-condensed table-striped table-bordered">
                    
                    <thead>
                        <tr>
                            <td> <input type="checkbox" class="select_box" value="" onclick="client_api.util.select_all(this, '#${group.id} .select_box')"> </td>
                            <th scope="col">Type</th>
                            <th scope="col">Instrument</th>
                            <th scope="col">Entry</th>
                            <th scope="col">LTP</th>
                            <th scope="col">P&L</th>
                            <th scope="col">Target</th>
                            <th scope="col">SL</th>
                            <th scope="col">Exit Limit</th>
                            <th scope="col">Quantity</th>
                            <th scope="col">Modify</th>
                            <th scope="col">Exit</th>
                        </tr>
                    </thead>
                    <tbody id="${group.id}" name="${group.name}"> </tbody>
                    <tfoot>
                        <tr id="summary-${group.id}" token="${group.id}" ttype="bull">
                            <th scope="col"></th>
                            <th scope="col"></th>
                            <th scope="col" class="max-profit-loss"></th>
                            <th scope="col">${group.name.toUpperCase()}</th>
                            <th>Total</th>
                            <th scope="col" class="pnl" id="pnl-${group.id}"></th>
                            <th><input type="text" disabled class="form-control target" placeholder="" value=""></th>
                            <th><input type="text" disabled class="form-control sl" placeholder="" value=""></th>
                            <th>
                                <select disabled class="form-select" onchange="client_api.trade.select_trade_type(this, $(this).parent().parent())" title="Trade type Bull/Bear">
                                    <option selected value="bull">Bull</option>
                                    <option value="bear">Bear</option>
                                </select>
                            </th>
                            <th scope="col"><button type="button" class="btn btn-success btn-sm modify" onclick="client_api.trade.modify(this, $(this).text(), true)">Edit</button></th>
                            <th scope="col" class="pos-mtm" id="ms-profit-${group.id}" title="Max Profit Seen"></th>
                            <th scope="col" class="neg-mtm" id="ms-loss-${group.id}" title="Max Loss Seen"></th>
                        </tr>
                    </tfoot> </table></div>`)
            },
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
    };

    function connect_to_server(){
        select_broker()
        broker.init();
        broker.connect();
        broker.search.attach_search_autocomplete();
        setTimeout(client_api.orderbook.update_open_orders, 100);
        setTimeout(client_api.trade.load_open_positions, 100);
        // setTimeout(client_api.watch_list.restore_watch_list, 100);
        setTimeout(client_api.trade.trigger, 1000);

        setTimeout(atm_tracker.find_atm_strikes, 1000)
        setTimeout(atm_tracker.display_atm_prices, 3000)
        // setTimeout(function(){algo.run('bank_nifty')}, 60000)
    }

    /*Attach functions to connect, add to watch list button, etc*/
    $(document).ready(function() {
        hide_other_tabs('#open_orders')
    });

    return {
        "subscribed_symbols": subscribed_symbols,
        "live_data": live_data,
        "show_success_msg" : show_success_msg,
        "show_error_msg" : show_error_msg,
        "connect_to_server" : connect_to_server,
        "select_broker" : select_broker,
        "atm_tracker": atm_tracker,
        "util": util,
        "watch_list": watch_list,
        "orderbook": orderbook,
        "trade" : trade,
        "positions" : positions,
        "mgr": milestone_manager,
        "order_mgr" : open_order_mgr,
        "toggle_paper_trade": toggle_paper_trade,
        "algo" : algo,
        "conf" : conf,
    }

}();


