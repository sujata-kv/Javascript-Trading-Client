client_api = window.client_api || {};

client_api = function () {
    let vix_tk, nifty_tk, bank_nifty_tk, fin_nifty_tk, midcap_nifty_tk, sensex_tk, bankex_tk = '';
    let user_id = '', session_token='', ws = '';
    let subscribed_symbols = []
    let pending_to_subscribe_tokens = new Set();
    let logged_in = false;
    let live_data = {};
    let broker = '';

    function select_broker() {
        let broker_name = $('#broker_option').val();

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
            vix_tk = '26017', nifty_tk = '26000', bank_nifty_tk = '26009', fin_nifty_tk = '26037', sensex_tk = '1', bankex_tk = '12', midcap_nifty_tk = '26074';
            subscribed_symbols = ["NSE|26017", "NSE|26000", "NSE|26009", "NSE|26037", "NSE|26074", "BSE|1", "BSE|12"];
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
                }, conf.heartbeat_timeout);
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
                        let pc = parseFloat(result.pc).toFixed(2)
                        live_data[instr_token] = ltpf
                        update_ltps(instr_token, ltpf, pc)
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

        get_remarks: function (params) {
            return params.remarks;
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
                        lib.show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                    }
                });
            },
        },

        search: {
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

            attach_search_autocomplete: function () {
                /* Search instrument autocomplete */
                $("input.search-instrument").autocomplete({
                    minLength: 2,
                    // autoFocus: true,
                    appendTo: '#instr-drop-down',
                    source: function (request, response) {
                        params = {"uid": user_id, "stext": encodeURIComponent(request.term)}
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
                                lib.show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                            },
                        })
                    },

                    select: this.select,

                    create: function () {
                        $(this).data('ui-autocomplete')._renderItem = function (ul, item) {
                            return $('<li>')
                                .append(item.label)
                                .append('</li>')
                                .appendTo(ul); // customize your HTML
                        };
                    }
                });

                watch_list.search.attach_keyboard_shortcuts();
            }
        },

        order : {
            get_order_params: function (elm, buy_or_sell, entry, qty, prd='') {

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
                    prd = prd==""?"I":prd;
                } else {
                    prd = prd==""?"M":prd;
                    if (tsym != undefined) {
                        if (tsym.startsWith("NIFTY"))
                            remarks = "N-" + Math.round(live_data[nifty_tk])
                        else if (tsym.startsWith("BANKNIFTY"))
                            remarks = "B-" + Math.round(live_data[bank_nifty_tk])
                        else if (tsym.startsWith("FINNIFTY"))
                            remarks = "F-" + Math.round(live_data[fin_nifty_tk])
                        else if (tsym.startsWith("SENSEX"))
                            remarks = "S-" + Math.round(live_data[sensex_tk])
                        else if (tsym.startsWith("BANKEX"))
                            remarks = "K-" + Math.round(live_data[bankex_tk])
                        else if (tsym.startsWith("MIDCP"))
                            remarks = "M-" + Math.round(live_data[midcap_nifty_tk])
                        remarks += " Vix " + live_data[vix_tk]
                    }
                }

                let values = {'ordersource': 'WEB'};
                values["uid"] = user_id;
                values["actid"] = user_id;
                values["trantype"] = buy_or_sell;
                values["prd"] = prd;
                values["exch"] = exch;
                values["tsym"] = encodeURIComponent(tsym);
                values["dname"] = encodeURIComponent(dname);
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

            place_order: function (params, success_cb) {
                shoonya.post_request(shoonya.url.place_order, params, success_cb);
            },

            cancel_order: function (orderno, tr_elm, success_cb) {
                let values = {'ordersource': 'WEB'};
                values["uid"] = user_id;
                values["norenordno"] = orderno;

                shoonya.post_request(broker.url.cancel_order, values, function (data) {
                    if (data.stat.toUpperCase() === "OK")
                        if(tr_elm!=null) tr_elm.remove();

                    if (data.result != undefined) {
                        let orderno = data.result;  //For cancel order, order-id is contained in result variable
                        if(success_cb!=undefined)
                            broker.order.get_orderbook(success_cb)
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
                values["tsym"] = encodeURIComponent(tr_elm.attr('tsym'));
                values["qty"] = qty;
                values["prctyp"] = prctyp;
                values["prc"] = price;

                values["norenordno"] = order_id;

                shoonya.post_request(broker.url.modify_order, values, function (data) {
                    if (data.stat == "Ok") {
                        let orderno = data.result;  // In case of modify and cancel order 'result' contains order ID.
                        data.orderno = orderno
                        success_call_bk(data)
                        lib.show_success_msg("Order with order num : " + orderno + " modified successfully")
                    } else lib.show_error_msg(data.emsg)
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
                            // console.log("get_orderbook success")
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
                        lib.show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                    }
                });
            },

            exit_order : function(values, success_cb) {
                shoonya.post_request(shoonya.url.place_order, values, success_cb);
            },
        }

    }
    
    let kite = {
        name : "kite",
        
        url : {
            websocket : "wss://ws.zerodha.com/",
            order_book : "https://kite.zerodha.com/oms/orders",
            place_order : "https://kite.zerodha.com/oms/orders/",
            modify_order : "https://kite.zerodha.com/oms/orders/",
            cancel_order : "https://kite.zerodha.com/oms/orders/",
            exit_order : "https://kite.zerodha.com/oms/orders/",
            positions : "https://kite.zerodha.com/oms/portfolio/positions",
        },
        
        init : function() {
            vix_tk = 264969, nifty_tk = 256265, bank_nifty_tk = 260105, fin_nifty_tk = 257801, midcap_nifty_tk = 260873, sensex_tk = 265, bankex_tk =0 ;
            subscribed_symbols = [256265, 260105, 257801, 264969, 260873, 265];
        },

        connect : function() {

            kite.search.load_data();

            let ws_url = this.url.websocket + `?api_key=kitefront&user_id=${user_id}&enctoken=${encodeURIComponent(session_token)}&user-agent=kite3-web&version=3.0.14`
            console.log(ws_url)
    
            ws = new WebSocket(ws_url);
            ws.binaryType = 'arraybuffer';
    
            ws.onopen = function (event) {
                if(subscribed_symbols.length > 0)
                    subscribed_symbols.forEach(kite.subscribe_token)
            };
    
            ws.onmessage = function (e) {
                if(e.data instanceof ArrayBuffer) {
                    // Trigger on message event when binary message is received
                    kite.data_handler.trigger("message", [e.data]);
                    if(e.data.byteLength > 2) {
                        var ticks = kite.data_handler.parseBinary(e.data);
                        if(ticks) {
                            for(let i=0; i<ticks.length; ++i) {
                                let instr_token = ticks[i]['instrument_token'], ltp = ticks[i]['last_price'];
                                let ltpf = parseFloat(ltp)
                                live_data[instr_token] = ltpf
                                update_ltps(instr_token, ltpf)
                            }
                        }
                    }
                }
            };

            ws.onclose = function (event) {
                login_status(false)
                console.log('WebSocket is closed. Reconnect will be attempted in 1 second.', event.reason);
                setTimeout(function () {
                    kite.connect();
                }, 1000);
            };

            ws.onerror = function (event) {
                login_status(false)
                console.error("WebSocket error: ", event);
            };

        },

        subscribe_token: function (token) {
            pending_to_subscribe_tokens.add(token);
            for (token of pending_to_subscribe_tokens.keys()) {
                if (ws.readyState !== WebSocket.OPEN) {
                    console.log("Web socket not ready yet.. " + token)
                    setTimeout(function () {
                        kite.subscribe_token(token)
                    }, 1000)
                } else {
                    console.log("Web socket is open.. Subscribing ", token)
                    if (!logged_in){
                        login_status(true)
                    }

                    let mesg = {"a": "subscribe", "v": [token]}
                    ws.send(JSON.stringify(mesg));

                    mesg = {"a": "mode", "v": ["ltp", [token]]}
                    ws.send(JSON.stringify(mesg));

                    if (!subscribed_symbols.includes(token))
                        subscribed_symbols.push(token);
                    pending_to_subscribe_tokens.delete(token);
                }
            }
        },

        data_handler : {

            segment_const: {
                // segment constants
                NseCM: 1,
                NseFO: 2,
                NseCD: 3,
                BseCM: 4,
                BseFO: 5,
                BseCD: 6,
                McxFO: 7,
                McxSX: 8,
                Indices: 9
            },

            triggers: {
                "connect": [],
                "ticks": [],
                "disconnect": [],
                "error": [],
                "close": [],
                "reconnect": [],
                "noreconnect": [],
                "message": [],
                "order_update": []
            },

            // trigger event callbacks
            trigger: function (e, args) {
                if (!this.triggers[e]) return
                for (var n = 0; n < this.triggers[e].length; n++) {
                    this.triggers[e][n].apply(this.triggers[e][n], args ? args : []);
                }
            },

            parseTextMessage: function (data) {
                try {
                    data = JSON.parse(data)
                    console.log(data)
                } catch (e) {
                    return
                }

                if (data.type === "order") {
                    console.log("order_update", [data.data]);
                }
            },

            parseBinary: function (binpacks) {
                var packets = this.splitPackets(binpacks),
                    ticks = [];

                for (var n = 0; n < packets.length; n++) {
                    var bin = packets[n],
                        instrument_token = this.buf2long(bin.slice(0, 4)),
                        segment = instrument_token & 0xff;

                    var tradable = true;
                    if (segment === this.segment_const.Indices) tradable = false;

                    // Add price divisor based on segment
                    var divisor = 100.0;
                    if (segment === this.segment_const.NseCD) {
                        divisor = 10000000.0;

                    } else if (segment == this.segment_const.BseCD) {
                        divisor = 10000.0;
                    }

                    // Parse LTP
                    if (bin.byteLength === 8) {
                        ticks.push({
                            tradable: tradable,
                            mode: "ltp",
                            instrument_token: instrument_token,
                            last_price: this.buf2long(bin.slice(4, 8)) / divisor
                        });
                        // Parse indices quote and full mode
                    } else if (bin.byteLength === 28 || bin.byteLength === 32) {
                        var mode = modeQuote;
                        if (bin.byteLength === 32) mode = modeFull;

                        var tick = {
                            tradable: tradable,
                            mode: mode,
                            instrument_token: instrument_token,
                            last_price: this.buf2long(bin.slice(4, 8)) / divisor,
                            ohlc: {
                                high: this.buf2long(bin.slice(8, 12)) / divisor,
                                low: this.buf2long(bin.slice(12, 16)) / divisor,
                                open: this.buf2long(bin.slice(16, 20)) / divisor,
                                close: this.buf2long(bin.slice(20, 24)) / divisor
                            },
                            change: this.buf2long(bin.slice(24, 28))
                        };

                        // Compute the change price using close price and last price
                        if (tick.ohlc.close != 0) {
                            tick.change = (tick.last_price - tick.ohlc.close) * 100 / tick.ohlc.close;
                        }

                        // Full mode with timestamp in seconds
                        if (bin.byteLength === 32) {
                            tick.exchange_timestamp = null;
                            var timestamp = this.buf2long(bin.slice(28, 32));
                            if (timestamp) tick.exchange_timestamp = new Date(timestamp * 1000);
                        }

                        ticks.push(tick);
                    } else if (bin.byteLength === 44 || bin.byteLength === 184) {
                        var mode = modeQuote;
                        if (bin.byteLength === 184) mode = modeFull;

                        var tick = {
                            tradable: tradable,
                            mode: mode,
                            instrument_token: instrument_token,
                            last_price: this.buf2long(bin.slice(4, 8)) / divisor,
                            last_traded_quantity: this.buf2long(bin.slice(8, 12)),
                            average_traded_price: this.buf2long(bin.slice(12, 16)) / divisor,
                            volume_traded: this.buf2long(bin.slice(16, 20)),
                            total_buy_quantity: this.buf2long(bin.slice(20, 24)),
                            total_sell_quantity: this.buf2long(bin.slice(24, 28)),
                            ohlc: {
                                open: this.buf2long(bin.slice(28, 32)) / divisor,
                                high: this.buf2long(bin.slice(32, 36)) / divisor,
                                low: this.buf2long(bin.slice(36, 40)) / divisor,
                                close: this.buf2long(bin.slice(40, 44)) / divisor
                            }
                        };

                        // Compute the change price using close price and last price
                        if (tick.ohlc.close != 0) {
                            tick.change = (tick.last_price - tick.ohlc.close) * 100 / tick.ohlc.close;
                        }

                        // Parse full mode
                        if (bin.byteLength === 184) {
                            // Parse last trade time
                            tick.last_trade_time = null;
                            var last_trade_time = this.buf2long(bin.slice(44, 48));
                            if (last_trade_time) tick.last_trade_time = new Date(last_trade_time * 1000);

                            // Parse timestamp
                            tick.exchange_timestamp = null;
                            var timestamp = this.buf2long(bin.slice(60, 64));
                            if (timestamp) tick.exchange_timestamp = new Date(timestamp * 1000);

                            // Parse OI
                            tick.oi = this.buf2long(bin.slice(48, 52));
                            tick.oi_day_high = this.buf2long(bin.slice(52, 56));
                            tick.oi_day_low = this.buf2long(bin.slice(56, 60));
                            tick.depth = {
                                buy: [],
                                sell: []
                            };

                            var s = 0, depth = bin.slice(64, 184);
                            for (var i = 0; i < 10; i++) {
                                s = i * 12;
                                tick.depth[i < 5 ? "buy" : "sell"].push({
                                    quantity: this.buf2long(depth.slice(s, s + 4)),
                                    price: this.buf2long(depth.slice(s + 4, s + 8)) / divisor,
                                    orders: this.buf2long(depth.slice(s + 8, s + 10))
                                });
                            }
                        }

                        ticks.push(tick);
                    }
                }

                return ticks;
            },

            splitPackets: function (bin) {
                // number of packets
                var num = this.buf2long(bin.slice(0, 2)),
                    j = 2,
                    packets = [];

                for (var i = 0; i < num; i++) {
                    // first two bytes is the packet length
                    var size = this.buf2long(bin.slice(j, j + 2)),
                        packet = bin.slice(j + 2, j + 2 + size);

                    packets.push(packet);

                    j += 2 + size;
                }

                return packets;
            },

            // Big endian byte array to long.
            buf2long: function (buf) {
                var b = new Uint8Array(buf),
                    val = 0,
                    len = b.length;

                for (var i = 0, j = len - 1; i < len; i++, j--) {
                    val += b[j] << (i * 8);
                }

                return val;
            },
        },

        search : {
            url_nfo: "https://api.kite.trade/instruments/NFO",
            url_nse: "https://api.kite.trade/instruments/NSE",
            url_mcx: "https://api.kite.trade/instruments/MCX",

            parsedData : [],

            parseNfoData :function (data) {
                const i_instrument_token = 0;
                const i_exchange_token = 1;
                const i_tradingsymbol = 2;
                const i_name = 3;
                const i_last_price = 4;
                const i_expiry = 5;
                const i_strike = 6;
                const i_tick_size = 7;
                const i_lot_size = 8;
                const i_instrument_type = 9;
                const i_segment = 10;
                const i_exchange = 11;

                const parsedData = [];
                const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

                function getDname(name, columns) {
                    let expiry = columns[i_expiry].split('-')
                    let month = months[parseInt(expiry[1])-1]
                    if (columns[i_instrument_type] === "FUT") {
                        return name + " " + month + " FUT";
                    } else if (columns[i_instrument_type] === "CE" || columns[i_instrument_type] === "PE")
                        return name + " " + expiry[2] + " " + month + " " + expiry[0]+ " " + (columns[i_strike] == 0 ? '' : columns[i_strike] + " ") + columns[i_instrument_type]
                }

                const rows = data.split("\n");
                rows.shift(); //Remove first element which is the header
                for (const row of rows) {
                    const columns = row.split(",");
                    if (columns[i_name] != undefined) {
                        const name = columns[i_name].replace(/"/g, '');
                        const dname = getDname(name, columns)
                        if (name === "NIFTY" || name === "BANKNIFTY" || name === "FINNIFTY" || name === "SENSEX" || columns[i_instrument_type] === "FUT") {
                            let obj = {
                                'value': dname,
                                // 'label' : columns[i_tradingsymbol],
                                'name': name,
                                'lot_size': columns[i_lot_size],
                                'instrument_token': columns[i_instrument_token],
                                'exch': columns[i_exchange],
                                'token': columns[i_exchange_token],
                                'tsym': columns[i_tradingsymbol],
                                'dname': dname,
                                'optt': columns[i_instrument_type],
                                'expiry': columns[i_expiry],
                            }
                            // console.log(dname)
                            parsedData.push(obj);
                        }
                    }
                }
                console.log("Total instrument entries loaded : " + parsedData.length)
                return parsedData;
            },

            parseNseMcxData :function (data) {
                const i_instrument_token = 0;
                const i_exchange_token = 1;
                const i_tradingsymbol = 2;
                const i_name = 3;
                const i_last_price = 4;
                const i_expiry = 5;
                const i_strike = 6;
                const i_tick_size = 7;
                const i_lot_size = 8;
                const i_instrument_type = 9;
                const i_segment = 10;
                const i_exchange = 11;

                const parsedData = [];

                const rows = data.split("\n");
                rows.shift(); //Remove first element which is the header
                for (const row of rows) {
                    const columns = row.split(",");
                    if (columns[i_name] != undefined) {
                        const name = columns[i_name].replace(/"/g, '');
                        const dname = columns[i_tradingsymbol]
                        let obj = {
                            'value': dname,
                            // 'label' : columns[i_tradingsymbol],
                            'name': name,
                            'lot_size': columns[i_lot_size],
                            'instrument_token': columns[i_instrument_token],
                            'exch': columns[i_exchange],
                            'token': columns[i_exchange_token],
                            'tsym': columns[i_tradingsymbol],
                            'dname': dname,
                            'optt': columns[i_instrument_type],
                            'expiry': columns[i_expiry],
                        }
                        // console.log(dname)
                        parsedData.push(obj);
                    }
                }
                console.log("Total instrument entries loaded : " + parsedData.length)
                return parsedData;
            },

            search_for_key: function (term) {
                let results = []
                for (const row of this.parsedData) {
                    var filterstrings = term.trim().toLowerCase().split(" ");
                    console.log(row)
                    let str = row['dname'].toLowerCase();
                    let found = true
                    for (const key of filterstrings) {
                        if (!str.includes(key)) {
                            found = false;
                            break;
                        }
                    }
                    if (found) results.push(row);
                    if (results.length == 50) break;
                }
                console.log(results.length + " number of results")
                if(results.length > 0) {
                    let res = results.map(obj => {
                        return {...obj, date: new Date(obj.expiry)};
                    });
                    results = res.sort(
                        (objA, objB) => Number(objA.date) - Number(objB.date),
                    );
                }
                return results;
            },

            load_data : async function() {

                const fetchData = async (url) => {
                    const response = await fetch(url);
                    const data = await response.text();
                    return data;
                };

                const data_nfo = await fetchData(this.url_nfo);
                this.parsedData = this.parseNfoData(data_nfo);

                const data_mcx = await fetchData(this.url_mcx);
                const mcx_parsed_data = this.parseNseMcxData(data_mcx);
                this.parsedData.push(...mcx_parsed_data);

                const data_nse = await fetchData(this.url_nse);
                const nse_parsed_data = this.parseNseMcxData(data_nse);
                this.parsedData.push(...nse_parsed_data);
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
                $(this).attr('instrument_token', ui.item.instrument_token)
                console.log("Selected item : ", ui.item)
            },

            attach_search_autocomplete : function() {
                /* Search instrument autocomplete */
                $("input.search-instrument").autocomplete({
                    minLength: 2,
                    // autoFocus: true,
                    appendTo: '#instr-drop-down',
                    source: function (request, response) {
                        const results = kite.search.search_for_key(request.term)
                        response(results)
                    },

                    select: this.select,

                    create: function () {
                        $(this).data('ui-autocomplete')._renderItem = function (ul, item) {
                            return $('<li>')
                                .append(item.label)
                                .append('</li>')
                                .appendTo(ul); // customize your HTML
                        };
                    }
                });

                watch_list.search.attach_keyboard_shortcuts();
            },
        },

        get_subscribe_token : function(params) {
            return parseInt(params.instrument_token);
        },

        get_ticker : function(params) {
            return params.instrument_token;
        },

        get_remarks: function (params) {
            return params.tag; //TODO - Check this
        },

        order : {
            map_orders: function (kite_orders) {
                if (kite_orders == undefined)
                    return undefined
                let std_orders = []
                for (const [key, kite_order] of Object.entries(kite_orders)) {
                    let std_order = this.map_order(kite_order);
                    std_orders.push(std_order);
                }
                return std_orders;
            },

            map_order: function (kite_order) {
                let std_order = {
                    'status': kite.order.get_std_order_status(kite_order.status),
                    'exch': kite_order.exchange,
                    'token': kite_order.exchange_token,
                    'instrument_token': kite_order.instrument_token,
                    'timestamp': (kite_order.order_timestamp != undefined)?kite_order.order_timestamp.split(' ')[1]:'',
                    'tsym': kite_order.tradingsymbol,
                    'amo': kite_order.variety == "amo" ? "Yes" : "No",
                    'trantype': kite_order.transaction_type == "BUY" ? "B" : "S",
                    'qty': kite_order.quantity,
                    'prc': kite_order.price,
                    'avgprc': kite_order.average_price,
                    'norenordno': kite_order.order_id,
                    'dname': kite_order.tradingsymbol,

                    'prctyp': kite_order.order_type,
                    'norentm': kite_order.exchange_timestamp,
                    'exch_time': kite_order.exchange_timestamp,
                    'rejreason': kite_order.status_message,
                    'remarks': kite_order.tag,
                    'prd': kite_order.product,
                    'exchordid': kite_order.exchange_order_id,

                    //Kite specific
                    'variety': kite_order.variety,
                }
                return std_order;
            },

            get_std_order_status: function (stat) {
                let std = ''
                if(stat != undefined) {
                    if (stat.includes('OPEN')) {
                        std = "OPEN"
                    } else if (stat.includes('CANCELLED')) {
                        std = "CANCELED"    // Matching shoonya status
                    } else if (stat.includes('COMPLETE')) {
                        std = "COMPLETE"
                    } else if (stat.includes('REJECTED')) {
                        std = "REJECTED"
                    } else if (stat.includes('REQ RECEIVED')) {
                        std = "OPEN"
                    }
                }
                return std;
            },

            get_orderbook : function(success_cb) {
                $.get({
                    url: kite.url.order_book,
                    dataType: "json",
                    headers : {
                        "Authorization" : "enctoken " + session_token,
                    },
                    success: function (data, textStatus, jqXHR) {
                        let orders = kite.order.map_orders(data.data)
                        success_cb(orders)
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.log("Ajax error : ", JSON.stringify(jqXHR))
                        if(jqXHR.status == 401)
                            login_status(false)
                        lib.show_error_msg(jqXHR.responseJSON.message)
                    }
                });
            },

            cancel_order: function (orderno, tr_elm, success_cb) {
                let variety = tr_elm.attr('variety')
                // let url = kite.url.cancel_order + "regular/" + orderno + "?order_id=" + orderno + "&parent_order_id=&variety=regular"
                let url = kite.url.cancel_order + variety + "/" + orderno + "?order_id=" + orderno + "&parent_order_id=&variety=" + variety
                $.ajax({
                    url: url,
                    type: "DELETE",
                    headers: {
                        "Authorization": "enctoken " + session_token,
                    },
                    success: function (data) {
                        if (data.status === "success")
                            if(tr_elm!=null) tr_elm.remove()

                        if (data.data.order_id != undefined) {
                            let orderno = data.data.order_id

                            kite.order.get_orderbook(function (data) {
                                success_cb(data)
                            })
                        }
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.log("Ajax error : ", JSON.stringify(jqXHR))
                        if (jqXHR.status == 401)
                            login_status(false)
                        lib.show_error_msg(jqXHR.responseJSON.message)
                    }
                });
            },

            modify_order: function (tr_elm, entry_obj, success_call_bk) {
                let prctyp = 'LIMIT', price = "0.0";
                if (entry_obj.value == '') {
                    prctyp = 'MARKET'
                } else price = entry_obj.value;

                let qty = tr_elm.find('.qty').val()
                let order_id = tr_elm.find('.order-num').html()

                let variety = tr_elm.attr('variety')
                let url = kite.url.modify_order + variety + "/" + order_id

                let payload = {
                    variety: variety,
                    exchange: tr_elm.attr('exch'),
                    tradingsymbol: encodeURIComponent(tr_elm.attr('tsym')),
                    transaction_type: tr_elm.attr('trtype') == 'B' ? 'BUY' : 'SELL',
                    order_type: prctyp,
                    quantity: qty,
                    price: price,
                    product: 'MIS',
                    validity: 'DAY',
                    disclosed_quantity: 0,
                    trigger_price: 0,
                    squareoff: 0,
                    stoploss: 0,
                    trailing_stoploss: 0,
                    user_id: user_id,
                    order_id: order_id,
                }

                $.ajax({
                    url: url,
                    type: "PUT",
                    dataType: "json",
                    data: payload,
                    headers: {
                        "Authorization": "enctoken " + session_token,
                    },
                    success: function (data) {
                        if (data.status === "success") {
                            if (data.data.order_id != undefined) {
                                let orderno = data.data.order_id
                                data.data.orderno = orderno
                                success_call_bk(data)
                                lib.show_success_msg("Order with order num : " + orderno + " modified successfully")
                            }
                        } else lib.show_error_msg(data.emsg)
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.log("Ajax error : ", JSON.stringify(jqXHR))
                        if (jqXHR.status == 401)
                            login_status(false)
                        lib.show_error_msg(jqXHR.responseJSON.message)
                    }
                })
            },

            get_order_params: function (tr_elm, buy_or_sell, entry_obj, qty, prd='') {

                let prctyp = 'LIMIT', price = "0.0";
                if (entry_obj.value == '') {
                    prctyp = 'MARKET'
                } else price = entry_obj.value;

                let remarks = "";
                let tsym = encodeURIComponent(tr_elm.attr('tsym'));
                let dname = encodeURIComponent(tr_elm.attr('dname'));
                let token = tr_elm.attr('token');
                let instrument_token = tr_elm.attr('instrument_token');
                if (entry_obj.value == '') {
                    prctyp = 'MARKET'
                } else
                    price = entry_obj.value.toString()
                let exch = tr_elm.attr('exch');

                if (exch == "NSE" || exch == "BSE") {
                    prd = prd==""?"MIS":prd;
                } else {
                    prd = prd==""?"NRML":prd;
                    if (tsym != undefined) {
                        if (tsym.startsWith("NIFTY"))
                            remarks = "N-" + Math.round(live_data[nifty_tk])
                        else if (tsym.startsWith("BANKNIFTY"))
                            remarks = "B-" + Math.round(live_data[bank_nifty_tk])
                        else if (tsym.startsWith("FINNIFTY"))
                            remarks = "F-" + Math.round(live_data[fin_nifty_tk])
                        else if (tsym.startsWith("SENSEX"))
                            remarks = "S-" + Math.round(live_data[sensex_tk])
                        else if (tsym.startsWith("BANKEX"))
                            remarks = "K-" + Math.round(live_data[bankex_tk])
                        else if (tsym.startsWith("MIDCP"))
                            remarks = "M-" + Math.round(live_data[midcap_nifty_tk])
                        remarks += " Vix " + live_data[vix_tk]
                    }
                }

                let payload = {
                    variety: 'regular',     //TODO - amo to regular
                    exchange: exch,
                    tradingsymbol: tsym,
                    instrument_token : instrument_token,
                    dname: dname,
                    transaction_type: buy_or_sell == 'B' ? 'BUY' : 'SELL',
                    order_type: prctyp,
                    quantity: qty,
                    price: price,
                    product: prd,
                    validity: 'DAY',
                    disclosed_quantity: 0,
                    trigger_price: 0,
                    squareoff: 0,
                    stoploss: 0,
                    trailing_stoploss: 0,
                    user_id: user_id,
                    tag : remarks,
                    token: token,
                }

                return payload;
            },

            place_order: function (pay_load, success_cb) {

                let url = kite.url.place_order + pay_load.variety

                $.ajax({
                    url: url,
                    // dataType: "json",
                    method: "POST",
                    data: pay_load,
                    headers: {
                        "Authorization": "enctoken " + session_token,
                    },
                    success: function (data, textStatus, jqXHR) {
                        let dt = {}
                        if (data.status === "success") {
                            dt.stat = "Ok";
                            dt.norenordno = data.data.order_id;
                        }
                        success_cb(dt);
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.log("Ajax error : ", JSON.stringify(jqXHR))
                        if (jqXHR.status == 401)
                            login_status(false)
                        lib.show_error_msg(jqXHR.responseJSON.message)
                    }
                });
            },

            exit_order : function(values, success_cb) {
                this.place_order(values, success_cb)
            },
        },

        position : {
            map_positions: function (kite_positions) {
                if (kite_positions == undefined)
                    return undefined
                let net_positions = kite_positions.data.net
                let std_positions = []

                for (const kite_position of net_positions) {
                    let std_pos = this.map_position(kite_position);
                    std_positions.push(std_pos);
                }
                return std_positions;
            },

            map_position: function (kite_position) {
                let std_pos = {
                    'stat': "Ok",
                    'prd' : kite_position.product,
                    'exch': kite_position.exchange,
                    'instrument_token': kite_position.instrument_token,
                    'token': kite_position.exchange_token,
                    'tsym': kite_position.tradingsymbol,
                    'daybuyavgprc': kite_position.day_buy_price.toFixed(2),
                    'daysellavgprc': kite_position.day_sell_price.toFixed(2),
                    'daybuyqty': kite_position.day_buy_quantity,
                    'daysellqty': kite_position.day_sell_quantity,
                    'remarks': kite_position.tag,
                    'urmtom':kite_position.realised.toFixed(2), // kite unrealised is not correct.. looks like unrealised and realised are swapped
                    'rpnl': kite_position.pnl.toFixed(2),
                    'lp' : kite_position.last_price.toFixed(2),
                    'daybuyamt' : kite_position.day_buy_value.toFixed(2) ,
                    'daysellamt' : kite_position.day_sell_value.toFixed(2) ,
                    'netqty' : kite_position.quantity,
                    'dayavgprc': kite_position.day_buy_price,
                    'netavgprc': (kite_position.quantity > 0)? kite_position.buy_price : kite_position.sell_price,
                }
                return std_pos;
            },

            get_positions: function (success_cb) {

                $.get({
                    url: kite.url.positions,
                    dataType: "json",
                    headers: {
                        "Authorization": "enctoken " + session_token,
                    },

                    success: function (data, textStatus, jqXHR) {
                        if(data.status == "success") {
                            let positions = kite.position.map_positions(data)
                            success_cb(positions)
                        } else {
                            lib.show_error_msg("Failed to fetch positions" + jqXHR.responseText)
                        }
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.error("Ajax error " + errorThrown)
                        lib.show_error_msg(jqXHR.responseText)
                    }
                });
            },
        },

        map_row_to_position : function(tr_elm) {
            lib.show_error_msg("Yet to be implemented")
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
    
    function update_ltps(instr_token, ltp, pc) {
        function set_values(id, ltp, pc) {
            $(id + ' .price').html(ltp)
            $(id +' .pc').html(pc + "%")
            if (pc < 0) {
                $(id).removeClass("pos-mtm")
                $(id).addClass("neg-mtm")
            } else {
                $(id).removeClass("neg-mtm")
                $(id).addClass("pos-mtm")
            }
        }

        switch (instr_token) {
            case vix_tk:
                set_values('#vix', ltp, pc);
                break;
            case nifty_tk:
                set_values('#nifty', ltp, pc);
                break;
            case bank_nifty_tk:
                set_values('#bank_nifty', ltp, pc);
                break;
            case fin_nifty_tk:
                set_values('#fin_nifty', ltp, pc);
                break;
            case sensex_tk:
                set_values('#sensex', ltp, pc);
                break;
            case bankex_tk:
                set_values('#bankex', ltp, pc);
                break;
            case midcap_nifty_tk:
                set_values('#midcap', ltp, pc);
                break;
            default:
                update_ltp('#watch_list_body .watch_' + instr_token, ltp);   //In watch list
                update_ltp("#open_orders .open_order_" + instr_token, ltp)  // In Open Order table
                update_ltp("#active_trades_div tbody .trade_" + instr_token, ltp)  // In Active Trades table
                break;
        }
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
                    lib.show_success_msg("Order is open. Order number: " + order.norenordno + "  Symbol: " + order.tsym + " Qty: " + order.qty);
                    break;
                case "COMPLETE" :
                    lib.show_success_msg("Order completed. Order number: " + order.norenordno + "  Symbol: " + order.tsym + " Qty: " + order.qty);
                    break;
                case "PENDING" :
                    lib.show_error_msg("Order pending. Order number: " + order.norenordno + "  Symbol: " + order.tsym + " Qty: " + order.qty);
                    break;
                case "REJECTED" :
                    lib.show_error_msg("Order " + order.norenordno + " rejected. Reason : " + order.rejreason  + "   Symbol: " + order.tsym + " Qty: " + order.qty, false );
                    break;
                case "CANCELED": // Matching shoonya status
                    lib.show_success_msg("Order " + order.norenordno + " cancelled. Symbol: " + order.tsym + " Qty: " + order.qty );
                    break;
                default:
                    lib.show_error_msg("Received invalid status for the order: " + order.norenordno + " Please verify the order status in the broker client" );
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
            if (order.status == "OPEN" || order.status == "PENDING") {
                broker.subscribe_token(order.subscribe_token)

                let type = order.amo == "Yes"? "AMO ": "";
                let buy_sell = '';
                if (order.trantype == "B") {
                    buy_sell = '<span class="badge bg-success">' + type + 'Buy</span><br>'
                } else {
                    buy_sell = '<span class="badge bg-danger">' + type + 'Sell</span><br>'
                }
                let ttype = orderbook.know_bull_or_bear(order)

                let dname = (order.dname != undefined)? order.dname : order.tsym;
                ++unique_row_id;
                let row_id = "row_id_" + unique_row_id;
                let target = sl = void_cond = "";
                let ret = milestone_manager.get_milestone_by_order_id(order.norenordno);

                if(ret != null) {    //Restore SL and Target if set for the open order
                    milestone_manager.change_row_id(ret.row_id, row_id)
                    target = milestone_manager.get_value_string(ret.milestone.target)
                    sl = milestone_manager.get_value_string(ret.milestone.sl)
                    void_cond = milestone_manager.get_value_string(ret.milestone.void_cond)
                }

                $('#open_order_list').append(`<tr id="${row_id}" ordid="${order.norenordno}" exch="${order.exch}" tsym="${order.tsym}" 
                                    qty="${order.qty}" token="${order.token}" ttype="${ttype}" trtype="${order.trantype}" variety="${order.variety}"">
                        <td>${buy_sell + order.token}</td>
                        <td class="order-num">${order.norenordno}</td>
                        <td>${dname}</td>
                        <th class="open_order_${order.token} ltp"></th>
                        <td><input type="text" class="form-control entry" placeholder=""  value="${order.prc}" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_entry(event, this, $(this).parent().parent().find('.modify'))"></td>
                        <td><input type="text" class="form-control target" placeholder=""  value="${target}" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></td>
                        <td><input type="text" class="form-control sl" placeholder=""  value="${sl}" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></td>
                        <td><input type="text" class="form-control void-cond" placeholder=""  value="${void_cond}" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></td>
                        <td><input type="text" class="form-control qty" placeholder=""  value="${order.qty}" ></td>
    
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
            if (entry_obj.type == MS_TYPE.spot_based || entry_obj.type == MS_TYPE.token_based || entry_obj.type == MS_TYPE.counter_token) {
                params.dname = tr_elm.attr('dname')
                if(broker.name != "shoonya")
                    params = broker.order.map_order(params)
                this.add_to_spot_order_list(params, entry_val)
            } else {
                console.log("Going to place order " + JSON.stringify(params))
                let orderId = tr_elm.attr('ordid')
                let paper_entry = false;
                paper_entry = orderId!=undefined && orderId.startsWith("paper");
                if(!is_paper_trade() && !paper_entry) { //Real trade
                    broker.order.place_order(params, function (data) {
                        if (success_cb != undefined) {  // Call custom function provided.. In case of exit, it needs to remove tr
                            console.log("Success call back is provided. Will be called")
                            success_cb(data)
                        } else { // No custom function provided. Default actions
                            console.log("Default place order call back called")
                            orderbook.place_order_cb_carry_target_sl_to_active_trade(data)
                        }
                    })
                } else {    //Paper trade
                    if(entry_val == 0.0) { //Market order. Place paper trade order immediately
                        params.norenordno = tr_elm.attr('ordid')
                        let target = "", sl ="";
                        if(params.norenordno != undefined && params.norenordno != "") {
                            let old_ms = milestone_manager.get_milestone_by_order_id(params.norenordno)
                            if(old_ms!=undefined && old_ms.row_id!=undefined) {
                                milestone_manager.remove_milestone(old_ms.row_id)
                                target = tr_elm.find('.target').val().trim();
                                sl = tr_elm.find('.sl').val().trim();
                            }
                        }

                        playSound = function () {
                            var audio = new Audio('../audio/beep_beep.mp3');
                            audio.loop = false;
                            audio.play();
                        }
                        playSound();
                        orderbook.place_paper_trade(params, live_data[broker.get_ticker(params)], target, sl)
                    } else {    //Limit order. Wait for price to reach the limit to enter paper trade
                        if(broker.name != "shoonya")
                            params = broker.order.map_order(params)
                        params.norenordno = "paper_open_"
                        this.add_to_spot_order_list(params, entry_val, paper_entry=true)
                    }
                }
            }

            setTimeout(function() {
                    tr_elm.find('.buy').removeAttr('disabled');
                    tr_elm.find('.sell').removeAttr('disabled');
            }, 500)
        },

        add_to_spot_order_list : function(item, entry_val, paper_entry=false) {
            let buy_sell = '';
            if (item.trantype === "B") {
                buy_sell = `<span class="badge bg-success">${paper_entry?"Paper":""} Buy</span><br>`
            } else {
                buy_sell = `<span class="badge bg-danger">${paper_entry?"Paper":""} Sell</span><br>`
            }

            let ttype = this.know_bull_or_bear(item)

            let ticker = broker.get_ticker({'token' : item.token, 'instrument_token': item.instrument_token})

            let dname = (item.dname != undefined)? decodeURIComponent(item.dname) : item.tsym;
            dname = dname.trim()
            let row_id = `row_id_${++unique_row_id}`
            item.norenordno = paper_entry? item.norenordno + row_id : item.norenordno;
            $('#spot_order_list').append(`<tr id="${row_id}" ordid="${item.norenordno}" exch="${item.exch}" tsym="${item.tsym}" dname="${dname}"  qty="${item.qty}" token="${item.token}" instrument_token="${item.instrument_token}" ttype="${ttype}" trtype="${item.trantype}">
                    <td>${buy_sell + ticker}</td>
                    <td class="order-num">Spot Based Entry</td>
                    <td>${dname}</td>
                    <th class="open_order_${ticker} ltp"></th>
                    <td><input type="text" class="form-control entry" placeholder=""  value="${entry_val}" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></td>
                    <td><input type="text" class="form-control target" placeholder=""  value="" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></td>
                    <td><input type="text" class="form-control sl" placeholder=""  value="" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></td>
                    <td><input type="text" class="form-control void-cond" placeholder=""  value="" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></td>
                    <td><input type="text" class="form-control qty" placeholder=""  value="${item.qty}"></td>

                    <td><button type="button" class="btn btn-success modify" onclick="client_api.orderbook.modify_order(this)">Modify</button></td>
                    <td><button type="button" class="btn btn-danger cancel" onclick="client_api.orderbook.cancel_order(this)">Cancel</button></td>
            </tr>`);

            let entry_obj = milestone_manager.get_value_object(entry_val)
            if(paper_entry) {   //Handle limit entry for paper trades..
                entry_obj.type = MS_TYPE.paper_entry;        //Manipulate entry obj to ensure that it checks for the entry trigger
                milestone_manager.add_entry(row_id, ticker, ttype, item.trantype, entry_obj);
                milestone_manager.add_order_id(row_id, item.norenordno)
            }
            else if(entry_obj.type == MS_TYPE.spot_based || entry_obj.type == MS_TYPE.token_based || entry_obj.type == MS_TYPE.counter_token)
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
                broker.order.cancel_order(orderno, tr_elm, function(orders) {
                    let matching_order = orders.find(order => order.norenordno === orderno)
                    if (matching_order != undefined) {
                        // orderbook.display_order_exec_msg(matching_order);    //Already being displayed in get_order_status
                    }
                    milestone_manager.remove_milestone(row_id); //Remove milestone
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

            let ticker = broker.get_ticker({'token': token, 'instrument_token': instrument_token})

            let target_value = tr_elm.find('.target').val()

            if(target_value == undefined || target_value == '') {
                milestone_manager.remove_target(row_id);
            } else { // Target has some value
                let target_obj = milestone_manager.get_value_object(target_value)
                milestone_manager.add_target(row_id, ticker, ttype, trtype, target_obj, true);
            }

            let sl_value = tr_elm.find('.sl').val()

            if(sl_value == undefined || sl_value == '') {
                milestone_manager.remove_sl(row_id);
            } else {  // SL has some value
                let sl_obj = milestone_manager.get_value_object(sl_value)
                milestone_manager.add_sl(row_id, ticker, ttype, trtype, sl_obj, true);
            }

            let void_cond = tr_elm.find('.void-cond').val()

            if(void_cond == undefined || void_cond == '') {
                milestone_manager.remove_void_cond(row_id);
            } else {  // SL has some value
                let void_cond_obj = milestone_manager.get_value_object(void_cond)
                milestone_manager.add_void_cond(row_id, ticker, ttype, trtype, void_cond_obj, true);
            }


            let entry_obj = milestone_manager.get_value_object(entry_value)
            if((entry_obj.type != MS_TYPE.price_based && entry_obj.value != '') || is_paper_trade()) {  // Spot based entry
                if(is_paper_trade()) {
                    entry_obj.type = MS_TYPE.paper_entry;        //Manipulate entry obj to ensure that it checks for the entry trigger
                }
                milestone_manager.add_entry(row_id, ticker, ttype, trtype, entry_obj)
                //Existing order should be cancelled, if there is an open order
                if(!order_id.includes('Spot')) {  // If the previous order is not Spot based entry, i.e there is an open order and now it is changed to Spot order
                    broker.order.cancel_order(order_id, null)
                }
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
                                    const ms_obj = milestone_manager.get_milestone_by_order_id(order_id);
                                    let target = '';
                                    let sl = '';
                                    if (ms_obj != undefined) {
                                        const old_row_id = ms_obj.row_id;
                                        target = (ms_obj.milestone.target != undefined)? milestone_manager.get_value_string(ms_obj.milestone.target) : ''
                                        sl = (ms_obj.milestone.sl != undefined)? milestone_manager.get_value_string(ms_obj.milestone.sl) : ''
                                        milestone_manager.remove_milestone(old_row_id); //Target and SL have been taken into Active Trade Row
                                    }
                                    trade.display_active_trade(matching_order, target, sl);
                                    orderbook.update_open_order_list(orders);
                                }
                            })(row_id));
                        }
                    });
                } else { // Place fresh order as spot entry value has been removed as orderno contains "Spot based entry"
                    if(!is_paper_trade()) { //Do this only if real trade
                        orderbook.place_buy_sell_order(tr_elm, tr_elm.attr('trtype'), function (data) {
                            orderbook.place_order_cb_carry_target_sl_to_active_trade(data, row_id)
                        });
                        tr_elm.remove()
                    }
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
                lib.show_error_msg(data.emsg);
        },

        place_order_default_cb : function(matching_order, orders, row_id) {

            let  order_id = matching_order.norenordno
            console.log("Place Order completed.. " + order_id)
            console.log(open_order_mgr.open_orders[order_id])
            if (row_id == undefined)
                row_id = orderbook.get_row_id_by_order_id(order_id);

            milestone_manager.add_order_id(row_id, order_id);

            matching_order.prc = matching_order.avgprc; // When order status is COMPLETE avgprc field contains the correct price
            const ms_obj = milestone_manager.get_milestone_by_order_id(order_id);
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

        place_paper_trade : function(order, ltp, target, sl) {

            let order_id = "";
            if(order.norenordno === undefined || order.norenordno === "") {
                order_id = "paper" + Date.now()
                order.norenordno = order_id
            } else {
                order_id = order.norenordno
            }
            order.prc = ltp
            order.norentm = new Date().toLocaleTimeString()
            order.exch = (order.exch === undefined)? order.exchange : order.exch
            order.trantype = (order.trantype === undefined)? (order.transaction_type=="BUY"? "B": "S") : order.trantype
            order.qty = (order.qty === undefined)? order.quantity : order.qty
            order.remarks = (order.remarks === undefined)? order.tag : order.remarks
            order.tsym = (order.tsym === undefined)? order.tradingsymbol : order.tsym

            order.tsym = decodeURIComponent(order.tsym)
            order.dname = decodeURIComponent(order.dname)

/*            ++unique_row_id;
            let row_id = "row_id_" + unique_row_id;
            milestone_manager.add_order_id(row_id, order_id);*/

            trade.display_active_trade(order, target, sl, true);
        },

        //TODO - Partial quantity exit should be done
        exit_order : function(td_elm) {
            let tr_elm = $(td_elm).parent().parent();
            let to_be_closed_order_id = tr_elm.attr('ordid')
            let limit_value = tr_elm.find('.exit-limit').val()
            tr_elm.find('.exit-limit').val(''); //Reset once used
            let qty = tr_elm.find('.qty').val()
            let prd = tr_elm.attr('prd')

            let buy_sell= tr_elm.attr('trtype') == 'B' ? 'S' : 'B'; // Do the opposite
            let exit_limit = milestone_manager.get_value_object(limit_value);
            let values = broker.order.get_order_params(tr_elm, buy_sell, exit_limit, qty, prd)

            let paper_active_trade = to_be_closed_order_id!=undefined && to_be_closed_order_id.startsWith("paper")
            if(!is_paper_trade() && !paper_active_trade) {
                broker.order.exit_order(values, function (data) {
                    if (data.stat.toUpperCase() === "OK") {
                        let orderno = data.norenordno;
                        open_order_mgr.add_exit(orderno)

                        orderbook.get_order_status(orderno, ACTION.exit, (function (tr_elm) {
                            return function (matching_order, orders) {
                                orderbook.exit_order_cb(matching_order, orders, tr_elm);
                                open_order_mgr.remove_order_id(orderno)
                            }
                        })(tr_elm))

                        orderbook.update_open_orders();  // This line was before add_exit() call above. Moved to see if it fixes the kill-switch bug
                    } else
                        lib.show_error_msg(data.emsg);
                });
                $(td_elm).attr('disabled', 'disabled');
                setTimeout(function(td_elm){$(td_elm).removeAttr('disabled')}, 5000, td_elm)
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
                                    </br><span class="price exit-price" ondblclick="client_api.trade.edit_entry_price(this)">${matching_order.avgprc}</span>
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
            }
        },

        get_order_status(orderno, action, oncomplete_cb) {

            if(open_order_mgr.exec_permission(orderno, action)) {
                // console.log(action + ": get_order_status : " + orderno + " Making get_orderbook post req")
                broker.order.get_orderbook(function (orders) {
                    let matching_order = orders.find(order => order.norenordno === orderno)
                    if (matching_order != undefined) {
                        // console.log(orderno + " : Found matching order ")
                        switch (matching_order.status) {
                            case "OPEN":
                                setTimeout(function () {
                                    orderbook.get_order_status(orderno, action, oncomplete_cb);
                                }, 2000)
                                break;
                            case "PENDING":
                                setTimeout(function () {
                                    orderbook.get_order_status(orderno, action, oncomplete_cb);
                                }, 2000)
                                break;
                            case "COMPLETE": // TODO - AMO ORDER CHANGE TO COMPLETE
                                console.log("Calling " + action + " on complete cb")
                                oncomplete_cb(matching_order, orders);
                                setTimeout(function(){
                                    console.log("Playing complete order sound..")
                                    document.getElementById('notify3').play()
                                }, 10);
                                break;
                            case "REJECTED":
                                orderbook.display_order_exec_msg(matching_order);
                                setTimeout(function(){
                                    console.log("Playing rejected order sound..")
                                    document.getElementById('notify1').play()
                                }, 10);
                                break;
                            case "CANCELED":
                                orderbook.display_order_exec_msg(matching_order);
                                setTimeout(function(){
                                    console.log("Playing cancelled order sound..")
                                    document.getElementById('notify1').play()
                                }, 10);
                                break;
                            default:
                                console.log("Unknown order status.. Please verify the order status manually in the broker client")
                                console.log(matching_order)
                                orderbook.display_order_exec_msg(matching_order);
                                setTimeout(function(){
                                    console.log("Playing default status sound..")
                                    document.getElementById('notify1').play()
                                }, 10);
                        }
                    }
                })
            }

        },

        show_orderbook : function() {
            $('#order_book_table').html("")
            hide_other_tabs('#order_book')
            broker.order.get_orderbook(function(orders) {
                if(orders!=undefined && Array.isArray(orders)) {
                    let completed_orders = 0;
                    orders.forEach((order) => { orderbook.show_order(order);
                        if(order.status === "COMPLETE") ++completed_orders;
                    })
                    lib.show_success_msg("Brokerage " + completed_orders * 20 + " Rs (No of completed orders: " + completed_orders + ")")
                }
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
            if(order.exch === "NFO" || order.exch === "BFO") {
                if(order.dname != undefined && order.dname != '') {  //"dname":"BANKNIFTY MAR FUT", "NIFTY 23MAR23 16000 PE ", "NIFTY 23MAR23 16000 CE ",
                    let dname = order.dname.trim()
                    if (dname.includes("PE")) {
                        if(order.trantype === "B") trade_type = "bear"
                        else if(order.trantype === "S") trade_type = "bull"
                    }
                    else if (dname.includes("CE")) {
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
            this.sl_hit_count = 0;
            this.open_order = false;
            this.order_id = '';
            this.entry;
            this.target;
            this.sl;
            this.void_cond;
        }

        set_open_order(open_order, order_id) {
            this.open_order = open_order;
            if(open_order) {
                this.order_id = order_id
            }
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
            this.sl_hit_count = 0;
        }

        get_sl() {
            return this.sl;
        }

        get_sl_hit_count() {
            return this.sl_hit_count;
        }

        increment_sl_hit_count() {
            this.sl_hit_count++;
        }

        set_void_cond(void_cond) {
            this.void_cond = void_cond;
        }

        get_void_cond() {
            return this.void_cond;
        }

        del_entry() {
            delete this.entry
        }

        del_target() {
            delete this.target
        }

        del_sl() {
            this.sl_hit_count = 0;
            delete this.sl
        }

        del_void_cond() {
            delete this.void_cond
        }

        is_safe_to_delete() {
            return this.entry == undefined && this.target == undefined && this.sl == undefined && this.void_cond == undefined;
        }
    }

    const MS_TYPE = Object.freeze({
        spot_based : "spot",
        token_based : "token",
        counter_token : "ctoken",
        price_based : "price",
        paper_entry : "paper",
    });

    class MileStoneManager {
        constructor() {
            this.milestones = {}
        }

        get_milestones() {
            return this.milestones;
        }

        get_value_object(val_str) {
            /* //Examples
            console.log(get_value_object("N-20000 D20"));
            console.log(get_value_object("B 20000 D5"));
            console.log(get_value_object("F 20000 D 5"));
            console.log(get_value_object("T24322 100 D 5"));    //Token based
            console.log(get_value_object("-10000 D 8"));*/

            let type = MS_TYPE.price_based;
            let instrument = 'price';
            let value = val_str;
            let delay = null

            if(value != undefined && value != ''){
                value = value.trim();
                value = value.toUpperCase()
                console.log(value)
                if(value.startsWith('N')  || value.startsWith('B') || value.startsWith('F') ||
                    value.startsWith('S')  || value.startsWith('K') || value.startsWith('M') ||
                    value.startsWith('T') || value.startsWith('C')) {
                    if(value.startsWith('T'))
                        type = MS_TYPE.token_based
                    else if(value.startsWith('C'))
                        type = MS_TYPE.counter_token
                    else
                        type = MS_TYPE.spot_based;
                    // value = value.replace(/-/, '')
                    value = value.trim()
                    let ii = (value).charAt(0)
                    if(ii === 'N')
                        instrument = 'nifty';
                    else if(ii === 'B')
                        instrument = 'bank_nifty'
                    else if(ii === 'F')
                        instrument = 'fin_nifty'
                    else if(ii === 'S')
                        instrument = 'sensex'
                    else if(ii === 'K')
                        instrument = 'bankex'
                    else if(ii === 'M')
                        instrument = 'midcap_nifty'
                    else if (ii === 'T' || ii === 'C') {
                        const regexPattern = /[TC](\d+) (.+)/;
                        const matches = value.match(regexPattern);
                        if (matches) {
                            // Extracted values
                            instrument = matches[1];        // Token is extracted into instrument
                            value = matches[2];

                            let params = {exch: "NFO", token: instrument, instrument_token: instrument}       //Token is subscribed to make sure to receive its live_data
                            let sym_token = broker.get_subscribe_token(params);
                            broker.subscribe_token(sym_token);
                        }
                    }
                    value = value.replace(/[ NBFSKMTC-]/g, '');
                }

                if(value.includes("D")) { //Extract delay
                    [value, delay] = value.split('D')
                }
            }

            let ret = {type : type, value : value, instrument : instrument, delay: delay }
            console.log(ret)
            return ret;
        }

        get_value_string(value_obj) {
            let value_str = '';

            switch(value_obj.type) {
                case MS_TYPE.spot_based:
                    switch(value_obj.instrument) {
                        case 'nifty' : value_str = 'N '; break;
                        case 'bank_nifty' : value_str = 'B '; break;
                        case 'fin_nifty' : value_str = 'F '; break;
                        case 'sensex' : value_str = 'S '; break;
                        case 'bankex' : value_str = 'K '; break;
                        case 'midcap_nifty' : value_str = 'M '; break;
                        // default : value_str = 'T' + instrument + " "; break;
                    }
                    value_str = value_str + value_obj.value.trim();
                    break;
                case MS_TYPE.token_based:
                    value_str = 'T' + instrument + " " + value_obj.value.trim();
                    break;
                case MS_TYPE.counter_token:
                    value_str = 'C' + instrument + " " + value_obj.value.trim();
                    break;
                case MS_TYPE.price_based:
                    value_str = value_obj.value.trim()
                    break;
            }

            if(value_obj.delay != undefined && value_obj.delay!=null) {
                value_str = `${value_str} D${value_obj.delay}`;
            }

            console.log(value_str)
            return value_str;
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

        get_milestone_by_row_id(row_id) {
            return this.milestones[row_id]
        }

        change_row_id(old_row_id, new_row_id) {
            let ms = this.milestones[old_row_id]
            this.milestones[new_row_id] = ms
            this.remove_milestone(old_row_id)
        }

        get_milestone_by_order_id(order_id) {
            for(const [row_id, milestone] of Object.entries(this.milestones)) {
                if(milestone.get_order_id() === order_id) {
                    return {
                        row_id : row_id,
                        milestone: milestone
                    };
                }
            }
            return null;
        }

        add_target(row_id, token, ttype, buy_sell, value_obj, open_order=false) {
            let old_ms = this.milestones[row_id]
            let order_id = open_order? $(`#${row_id}`).attr('ordid') : ""
            if(old_ms == undefined) {
                let ms = new MileStone(ttype, buy_sell, token);
                ms.set_target(value_obj);
                ms.set_open_order(open_order, order_id);
                this.milestones[row_id] = ms
            } else {
                old_ms.set_open_order(open_order, order_id);
                old_ms.set_ttype(ttype)
                old_ms.set_target(value_obj)
            }
            console.log(`${row_id} ${ttype.toUpperCase()} Target: ${JSON.stringify(value_obj)}  Token:${token}`)
        }

        add_sl(row_id, token, ttype, buy_sell, value_obj, open_order=false) {
            let old_ms = this.milestones[row_id]
            let order_id = open_order? $(`#${row_id}`).attr('ordid') : ""
            if(old_ms == undefined) {
                let ms = new MileStone(ttype, buy_sell, token);
                ms.set_sl(value_obj);
                ms.set_open_order(open_order, order_id);
                this.milestones[row_id] = ms
            } else {
                old_ms.set_open_order(open_order, order_id);
                old_ms.set_ttype(ttype)
                old_ms.set_sl(value_obj)
            }
            console.log(`${row_id} ${ttype.toUpperCase()} SL: ${JSON.stringify(value_obj)}  Token:${token}`)
        }

        add_void_cond(row_id, token, ttype, buy_sell, value_obj, open_order=false) {
            let old_ms = this.milestones[row_id]
            let order_id = open_order? $(`#${row_id}`).attr('ordid') : ""
            if(old_ms == undefined) {
                let ms = new MileStone(ttype, buy_sell, token);
                ms.set_void_cond(value_obj);
                ms.set_open_order(open_order, order_id);
                this.milestones[row_id] = ms
            } else {
                old_ms.set_open_order(open_order, order_id);
                old_ms.set_ttype(ttype)
                old_ms.set_void_cond(value_obj)
            }
            console.log(`${row_id} ${ttype.toUpperCase()} Void Condition: ${JSON.stringify(value_obj)}  Token:${token}`)
        }


        remove_entry(row_id) {
            let old_ms = this.milestones[row_id]
            if (old_ms != undefined) {
                old_ms.del_entry()
                if( old_ms.is_safe_to_delete()) {
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
                if( old_ms.is_safe_to_delete()) {
                    delete this.milestones[row_id]
                }
            }
        }

        remove_sl(row_id) {
            let old_ms = this.milestones[row_id]
            if (old_ms != undefined) {
                old_ms.del_sl()
                if( old_ms.is_safe_to_delete()) {
                    delete this.milestones[row_id]
                }
            }
        }

        remove_void_cond(row_id) {
            let old_ms = this.milestones[row_id]
            if (old_ms != undefined) {
                old_ms.del_void_cond()
                if( old_ms.is_safe_to_delete()) {
                    delete this.milestones[row_id]
                }
            }
        }


        increment_sl_hit_count(row_id) {
            let ms = this.milestones[row_id]
            if (ms != undefined) {
                ms.increment_sl_hit_count()
            }
        }

        remove_milestone(row_id) {
            // var err = new Error();
            // console.log(JSON.stringify( err.stack));
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
                    pnl_elm.removeClass('pos-mtm')
                    pnl_elm.addClass('neg-mtm')
                } else {
                    pnl_elm.removeClass('neg-mtm')
                    pnl_elm.addClass('pos-mtm')
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

            trade.update_total_margin(tbody);
            trade.reset_max_profit_loss(group_id);
            if(tbody.children().length === 0) { //Remove group if no position is left in the group
                tbody.parent().find('thead input:checkbox')[0].checked = false; //uncheck parent checkbox
                if(!group_id.includes('at-pool')) //Do not remove the pool
                    tbody.parent().parent().remove(); //Remove the div
            }
        },

        update_gross_pnl : function() {
            let total = 0
            $('#active_trades_div tfoot th.pnl').each(function() {
                let group_pnl = parseFloat($(this).text().trim());
                if(!isNaN(group_pnl))
                    total += group_pnl;
            })

            $('#gross_pnl').text(new Intl.NumberFormat().format(total.toFixed(0)))
            if(total < 0) {
                $('#gross_pnl').removeClass('pos-mtm')
                $('#gross_pnl').addClass('neg-mtm')
            } else {
                $('#gross_pnl').removeClass('neg-mtm')
                $('#gross_pnl').addClass('pos-mtm')
            }

            const row_id = 'gross_pnl';
            let ret = this.get_max_profit_loss(row_id, total);
            $('#gross_max_profit').text(ret['profit'].toFixed(2))
            $('#gross_max_loss').text(ret['loss'].toFixed(2))
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
                const notify = $('#notify-' + group_id)
                if (total < 0) {
                    // total_pnl_elm.css('color', 'red')
                    total_pnl_elm.removeClass('pos-mtm')
                    total_pnl_elm.addClass('neg-mtm')

                    //Check if the loss exceeds the alert threshold
                    let total_margin = parseFloat($(`#${group_id}`).attr('total-margin'))
                    let loss_pct = (total*(-1)*100)/total_margin
                    if (loss_pct >= conf.alert_loss_threshold) {
                        if(notify.children().length == 0) {
                            document.getElementById('notify2').play()
                            let message = "Loss threshold of " + conf.alert_loss_threshold + "% reached. Click to acknowledge";
                            notify.html(`<i class="bi bi-bell-fill neg-mtm" style="cursor:pointer" onclick="client_api.trade.ack_notify(this)" title="${message}"> </i>`)
                        }
                    }
                } else {
                    // total_pnl_elm.css('color', 'green')
                    total_pnl_elm.removeClass('neg-mtm')
                    total_pnl_elm.addClass('pos-mtm')

                    //Check if the profit exceeds the alert threshold
                    let total_margin = parseFloat($(`#${group_id}`).attr('total-margin'))
                    let profit_pct = (total*100)/total_margin
                    if (profit_pct >= conf.alert_profit_threshold) {
                        if(notify.children().length == 0) {
                            document.getElementById('notify1').play()
                            let message = "Profit threshold of " + conf.alert_profit_threshold + "% reached. Click to acknowledge";
                            notify.html(`<i class="bi bi-bell-fill pos-mtm" style="cursor:pointer" onclick="client_api.trade.ack_notify(this)" title="${message}"> </i>`)
                        }
                    }
                }
                let ret = this.get_max_profit_loss(row_id, total);
                total_pnl_elm.text(total.toFixed(2))
                $('#ms-profit-' + group_id).text(ret['profit'].toFixed(2))
                $('#ms-loss-' + group_id).text(ret['loss'].toFixed(2))
            }
            return total;
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
                lib.show_success_msg("Resetting the P&L")
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

                if(mile_stone.open_order) {
                    if(mile_stone.get_void_cond() != undefined) {// If it has void condition defined
                        // console.log('checking void condition')
                        check_void_cond_trigger(row_id, mile_stone)
                    }
                } else {
                    if (mile_stone.get_target() != undefined) {// If it has target object
                        // console.log('checking target trigger')
                        check_target_trigger(row_id, mile_stone)
                    }

                    if (mile_stone.get_sl() != undefined) {// If it has sl object
                        // console.log('checking SL trigger')
                        check_sl_trigger(row_id, mile_stone)
                    }
                }
            }

            trade.update_gross_pnl();

            setTimeout(trade.trigger, conf.target_sl_check_interval)

            function check_entry_trigger(row_id, mile_stone) {
                let cur_value = 0;
                let entry_obj = mile_stone.get_entry();
                let trig_value = parseFloat(entry_obj.value);
                let ttype = mile_stone.ttype;
                let buy_sell = mile_stone.buy_sell;
                if (entry_obj.type == MS_TYPE.spot_based) {
                    switch(entry_obj.instrument) {
                        case "nifty" : cur_value = live_data[nifty_tk]; break;
                        case "bank_nifty" : cur_value = live_data[bank_nifty_tk]; break;
                        case "fin_nifty" : cur_value = live_data[fin_nifty_tk]; break;
                        case "sensex" : cur_value = live_data[sensex_tk]; break;
                        case "bankex" : cur_value = live_data[bankex_tk]; break;
                        case "midcap_nifty" : cur_value = live_data[midcap_nifty_tk]; break;
                    }
                } else if (entry_obj.type == MS_TYPE.token_based || entry_obj.type == MS_TYPE.counter_token) {
                    cur_value = live_data[entry_obj.instrument];
                } else if(entry_obj.type == MS_TYPE.paper_entry) { // For paper entry counter token and token doesn't work
                    // console.log(row_id + " Paper trade with limit order.");
                    cur_value = live_data[mile_stone.token];
                }
                console.log(`Checking Entry : ${ttype}  current : ${cur_value}  trig : ${trig_value}`)

                //Only spot based entry should be checked. If it is price based then limit order will be placed in real. But for paper trade, check has to be there.
                if(entry_obj.type == MS_TYPE.spot_based) {
                    if (ttype === 'bull') {
                        if (cur_value <= trig_value) {
                            entry_triggered()
                        }
                    } else if (ttype === 'bear') {
                        if (cur_value >= trig_value) {
                            entry_triggered()
                        }
                    }
                } else if(entry_obj.type == MS_TYPE.price_based || entry_obj.type == MS_TYPE.paper_entry) {  //Only paper trade
                    if (cur_value <= trig_value) {
                        entry_triggered()
                    }
                } else if(entry_obj.type == MS_TYPE.token_based) {
                    if (cur_value <= trig_value) {
                        entry_triggered()
                    }
                } else if(entry_obj.type == MS_TYPE.counter_token) {
                    if(cur_value >= trig_value) {
                        entry_triggered()
                    }
                }

                function entry_triggered() {

                    if(milestone_manager.entry_exists(row_id)) {  // To avoid duplicate execution
                        lib.show_success_msg("Entry triggered for row_id : " + row_id + " Trigger value = " + trig_value + " Spot value = " + cur_value)
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

            function check_void_cond_trigger(row_id, mile_stone) {  //If void condition is triggered, open order needs to be cancelled
                let cur_spot_value = 0;
                let void_cond_obj = mile_stone.get_void_cond();
                let trig_value = parseFloat(void_cond_obj.value);
                let ttype = mile_stone.ttype;
                let buy_sell = mile_stone.buy_sell;
                if (void_cond_obj.type == MS_TYPE.spot_based) {
                    switch(void_cond_obj.instrument) {
                        case "nifty" : cur_spot_value = live_data[nifty_tk]; break;
                        case "bank_nifty" : cur_spot_value = live_data[bank_nifty_tk]; break;
                        case "fin_nifty" : cur_spot_value = live_data[fin_nifty_tk]; break;
                        case "sensex" : cur_spot_value = live_data[sensex_tk]; break;
                        case "bankex" : cur_spot_value = live_data[bankex_tk]; break;
                        case "midcap_nifty" : cur_spot_value = live_data[midcap_nifty_tk]; break;
                    }
                } else if (void_cond_obj.type == MS_TYPE.token_based || void_cond_obj.type == MS_TYPE.counter_token) {
                    cur_spot_value = live_data[void_cond_obj.instrument];
                } else { // Price based
                    cur_spot_value = live_data[mile_stone.token]; //Check for LTP of the instrument
                }

                console.log(`Checking Void Condition : ${ttype} for ${void_cond_obj.instrument} current : ${cur_spot_value}  trig : ${trig_value}`)

                if (void_cond_obj.type == MS_TYPE.spot_based) {
                    if (ttype === 'bull') {
                        if(cur_spot_value >= trig_value) {
                            void_cond_triggered()
                        }
                    } else if (ttype === 'bear') {
                        if(cur_spot_value <= trig_value) {
                            void_cond_triggered()
                        }
                    }
                } else {
                    //Counter token based
                    if(void_cond_obj.type === MS_TYPE.counter_token) {
                        if (buy_sell === 'S') {
                            if (cur_spot_value >= trig_value) {
                                void_cond_triggered()
                            }
                        } else if (buy_sell === 'B') {
                            if (cur_spot_value <= trig_value) {
                                void_cond_triggered()
                            }
                        }
                    } else {
                        //Price based and token based
                        // Instrument LTP based checking
                        if (buy_sell === 'B') {
                            if (cur_spot_value >= trig_value) {
                                void_cond_triggered()
                            }
                        } else if (buy_sell === 'S') {
                            if (cur_spot_value <= trig_value) {
                                void_cond_triggered()
                            }
                        }
                    }
                }

                function void_cond_triggered() {
                    let tr_elm = $(`#${row_id}`)

                    tr_elm.find('.cancel').click();

                    let name = "row: " + row_id
                    let msg = "Void condition triggered for " + name + " Trigger value = " + trig_value + " Current value = " + cur_spot_value
                    lib.show_success_msg(msg)
                    console.log(msg)
                    milestone_manager.remove_milestone(row_id)
                }
            }

            function check_target_trigger(row_id, mile_stone) {
                let cur_spot_value = 0;
                let target_obj = mile_stone.get_target();
                let trig_value = parseFloat(target_obj.value);
                let ttype = mile_stone.ttype;
                let buy_sell = mile_stone.buy_sell;
                if (target_obj.type == MS_TYPE.spot_based) {
                    switch(target_obj.instrument) {
                        case "nifty" : cur_spot_value = live_data[nifty_tk]; break;
                        case "bank_nifty" : cur_spot_value = live_data[bank_nifty_tk]; break;
                        case "fin_nifty" : cur_spot_value = live_data[fin_nifty_tk]; break;
                        case "sensex" : cur_spot_value = live_data[sensex_tk]; break;
                        case "bankex" : cur_spot_value = live_data[bankex_tk]; break;
                        case "midcap_nifty" : cur_spot_value = live_data[midcap_nifty_tk]; break;
                    }
                } else if (target_obj.type == MS_TYPE.token_based || target_obj.type == MS_TYPE.counter_token) {
                    cur_spot_value = live_data[target_obj.instrument];
                } else { // Price based
                    if(row_id.startsWith("summary-")) { // Use total P & L value in case of cumulative target and SL
                        cur_spot_value = $(`#${row_id}`).find('.pnl').text()
                        if(cur_spot_value!=undefined)
                            cur_spot_value = parseFloat(cur_spot_value)
                    } else {
                        cur_spot_value = live_data[mile_stone.token]; //Check for LTP of the instrument
                        /*let pnl = $(`#${row_id}`).find('.pnl').text()  //Check for PNL based target
                        cur_spot_value = parseFloat(pnl)*/
                    }
                }

                console.log(`Checking Target : ${ttype} for ${target_obj.instrument} current : ${cur_spot_value}  trig : ${trig_value}`)

                if (target_obj.type == MS_TYPE.spot_based) {
                    if (ttype === 'bull') {
                        if(cur_spot_value >= trig_value) {
                            target_triggered()
                        }
                    } else if (ttype === 'bear') {
                        if(cur_spot_value <= trig_value) {
                            target_triggered()
                        }
                    }
                } else {  //Price based and token based
                    if(row_id.startsWith("summary-")) {
                        if (cur_spot_value >= trig_value) {
                            target_triggered()
                        }
                    }else {
                        if(target_obj.type === MS_TYPE.counter_token) {
                            //Counter token
                            if (buy_sell === 'S') {
                                if (cur_spot_value >= trig_value) {
                                    target_triggered()
                                }
                            } else if (buy_sell === 'B') {
                                if (cur_spot_value <= trig_value) {
                                    target_triggered()
                                }
                            }
                        }
                        else {
                            // Instrument LTP based checking or Token based checking
                            if (buy_sell === 'B') {
                                if (cur_spot_value >= trig_value) {
                                    target_triggered()
                                }
                            } else if (buy_sell === 'S') {
                                if (cur_spot_value <= trig_value) {
                                    target_triggered()
                                }
                            }
                        }
                    }
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
                        let group_id = tr_elm.parent().attr('id')
                        if(util.grouping.is_cascade_exit_enabled(group_id)) {   //Exit the entire group
                            console.log("Cascade Exit is enabled for the group " + group_id + ". Exiting the entire group")
                            util.grouping.exit_group(`#${group_id}`, true)
                        } else  //Exit the row alone
                            tr_elm.find('.exit').click();
                    }
                    let name = (group_name=='')? "row: "+row_id : "group: " + group_name
                    msg = "Target triggered for " + name + " Trigger value = " + trig_value + " Current value = " + cur_spot_value
                    lib.show_success_msg(msg)
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
                let sl_action_threshold = 1;    //Default

                if (sl_obj.type === MS_TYPE.spot_based) {
                    switch(sl_obj.instrument) {
                        case "nifty" : cur_spot_value = live_data[nifty_tk]; break;
                        case "bank_nifty" : cur_spot_value = live_data[bank_nifty_tk]; break;
                        case "fin_nifty" : cur_spot_value = live_data[fin_nifty_tk]; break;
                        case "sensex" : cur_spot_value = live_data[sensex_tk]; break;
                        case "bankex" : cur_spot_value = live_data[bankex_tk]; break;
                        case "midcap_nifty" : cur_spot_value = live_data[midcap_nifty_tk]; break;
                    }
                } else if (sl_obj.type === MS_TYPE.token_based || sl_obj.type === MS_TYPE.counter_token) {
                    cur_spot_value = live_data[sl_obj.instrument];
                } else { // Price based
                    if (row_id.startsWith("summary-")) { // Use total P & L value in case of cumulative target and SL
                        cur_spot_value = $('#' + row_id).find('.pnl').text()
                        if (cur_spot_value != undefined)
                            cur_spot_value = parseFloat(cur_spot_value)
                    } else {
                        cur_spot_value = live_data[mile_stone.token];  //Check for LTP of the instrument
                        // let pnl = $(`#${row_id}`).find('.pnl').text()    //Check for pnl
                        // cur_spot_value = parseFloat(pnl)
                    }
                }

                if(sl_obj.delay != null) {
                    sl_action_threshold = Math.round(parseInt(sl_obj.delay) * 1000 / (conf.target_sl_check_interval + 20)); //20 milli seconds, extra execution time
                    console.log(`Checking SL : ${ttype} for ${sl_obj.instrument} current : ${cur_spot_value}  trig : ${trig_value}  delay : ${sl_obj.delay}s`)
                } else
                    console.log(`Checking SL : ${ttype} for ${sl_obj.instrument} current : ${cur_spot_value}  trig : ${trig_value}`)

                if(sl_obj.type === MS_TYPE.spot_based) {
                    if (ttype === 'bull') {
                        if (cur_spot_value <= trig_value) {
                            sl_triggered()
                        }
                    } else if (ttype === 'bear') {
                        if (cur_spot_value >= trig_value) {
                            sl_triggered()
                        }
                    }
                } else {
                    if(row_id.startsWith("summary-")) {
                        if (cur_spot_value <= trig_value) {
                            sl_triggered()
                        }
                    } else {
                        if(sl_obj.type === MS_TYPE.counter_token) {
                            //Counter token
                            if (buy_sell === 'S') {
                                if (cur_spot_value <= trig_value) {
                                    sl_triggered()
                                }
                            } else if (buy_sell === 'B') {
                                if (cur_spot_value >= trig_value) {
                                    sl_triggered()
                                }
                            }
                        } else {
                            // //Price and token based
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
                }

                function sl_triggered() {
                    let msg, group_name='';

                    let ms = milestone_manager.get_milestone_by_row_id(row_id)
                    if( ms.get_sl_hit_count() >= sl_action_threshold ) { //Take action only if sl_action_threshold is exceeded

                        if (row_id.startsWith("summary-")) {
                            let group_id = row_id.replace('summary-', '')
                            group_name = row_id.replace('summary-at-', '').toUpperCase()
                            let group_selector = '#' + group_id;
                            util.grouping.exit_group(group_selector, true)
                        } else {
                            let tr_elm = $(`#${row_id}`)
                            let group_id = tr_elm.parent().attr('id')
                            if(util.grouping.is_cascade_exit_enabled(group_id)) {   //Exit the entire group
                                console.log("Cascade Exit is enabled for the group " + group_id + ". Exiting the entire group")
                                util.grouping.exit_group(`#${group_id}`, true)
                            } else  //Exit the row alone
                                tr_elm.find('.exit').click();
                        }
                        let name = (group_name == '') ? "row: " + row_id : "group: " + group_name
                        msg = "SL triggered for " + name + " Trigger value = " + trig_value + " Current value = " + cur_spot_value
                        lib.show_error_msg(msg)
                        console.log(msg)

                        milestone_manager.remove_milestone(row_id)
                    } else {
                        milestone_manager.increment_sl_hit_count(row_id)
                        console.log("SL hit count = " + ms.get_sl_hit_count() + "/" + sl_action_threshold+ ", Trigger threshold count = " + sl_action_threshold + " delay: " + sl_obj.delay + " seconds")
                    }
                }
            }
        },

        close_all_trades: function () {
            $('#active_trades_div tfoot tr').each(function(index, tr_elm) {
                milestone_manager.remove_milestone($(tr_elm).attr('id'));
            })

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
        },

        ack_notify(elm){
            /*$(elm).removeClass("bi-bell-fill");
            $(elm).addClass("bi-bell-slash-fill");*/
            $(elm).parent().html('')
        },

        update_total_margin: function (tbody_elm) {
            //Update the total margin
            let total_margin = 0;
            tbody_elm.find('tr').each(function (i, row) {
                total_margin += parseFloat($(row).attr('margin'))
            })
            tbody_elm.attr('total-margin', total_margin)
        },

        display_active_trade : function(order, target, sl, paper_trade=false, row_id) {
            let ttype = orderbook.know_bull_or_bear(order)
            let buy_sell = '';
            let paper_tag = paper_trade?"Paper ":""
            if (order.trantype == "B") {
                buy_sell = `<span class="badge bg-success"> ${paper_tag} Buy</span><br>`
            } else {
                buy_sell = `<span class="badge bg-danger"> ${paper_tag} Sell</span><br>`
            }
            let dname = (order.dname != undefined)? order.dname : order.tsym;

            console.log("Active trade : " + JSON.stringify(order))
            if(row_id == undefined) {
                row_id = "row_id_" + ++unique_row_id;
            }

            let ticker = broker.get_ticker(order)
            let className= (ttype==="bear")?"table-danger":" ";

            let tbody_elm = $('#at-pool');
            // let remarks = order.remarks.substring(0, order.remarks.indexOf(" Vix"));
            let remarks = order.remarks;
            let margin_used = (order.prc * order.qty).toFixed(2);

            tbody_elm.append(`<tr id="${row_id}" class="${className}" ordid="${order.norenordno}"  exch="${order.exch}" token="${order.token}" instrument_token="${order.instrument_token}" qty="${order.qty}" tsym="${order.tsym}" ttype="${ttype}" trtype="${order.trantype}" prd="${order.prd}" trade="active" margin="${margin_used}">
                        <td> <input type="checkbox" class="select_box" value="" onclick="client_api.util.uncheck(this)"> </td>
                        <td>${buy_sell + ticker}</td>
                        <td class="instrument">${dname}</td>
                        <td class="entry num" title="Margin Used : ${margin_used}">
                            <span class="badge badge-pill bg-dark">${order.norentm.split(" ")[0]}</span>
                            </br><span class="badge bg-primary">${remarks}</span>
                            </br><span class="price" ondblclick="client_api.trade.edit_entry_price(this)">${order.prc}</span>
                        </td>
                        <td class="trade_${ticker} ltp">${live_data[ticker]}</td>
                        <td class="pnl"></td>
                        <td><input type="text" disabled class="form-control target" placeholder="" value="" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></td>
                        <td><input type="text" disabled class="form-control sl" placeholder="" value="" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></td>
                        <td><input type="text" class="form-control exit-limit" placeholder="" ondblclick="client_api.watch_list.add_ltp(this); $(this).unbind('click');" onkeydown="client_api.util.handle_limit_exit(event, this, $(this).parent().parent().find('.exit'))"></td>
                        <td><input type="text" class="form-control qty" placeholder=""  value="${order.qty}"></td>
                        <td><button type="button" class="btn btn-success modify" onclick="client_api.trade.modify(this, $(this).text())">Edit</button></td>
                        <td><button type="button" class="btn btn-danger exit" onclick="client_api.trade.exit(this)">Exit</button></td>
                </tr>`);

            trade.update_total_margin(tbody_elm);

            if(target != undefined && target != '' ) {
                milestone_manager.add_target(row_id, ticker, ttype, order.trantype, milestone_manager.get_value_object(target))
                $('#' + row_id).find('.target').val(target)
            }
            if(sl != undefined && sl != '' ) {
                milestone_manager.add_sl(row_id, ticker, ttype, order.trantype, milestone_manager.get_value_object(sl))
                $('#' + row_id).find('.sl').val(sl)
            }

            trade.calculate_spreads(tbody_elm, $('#summary-at-pool .max-profit-loss'));
        },

        calculate_spreads : function(tbody_elm, print_cell) {
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
                    let prc1 = parseFloat(row1.find('.entry>.price').text())
                    let prc2 = parseFloat(row2.find('.entry>.price').text())

                    console.log(prc1, prc2)

                    let leg1_is_buy = row1.attr('trtype') == 'B'
                    let credit_spread = false;
                    if(prc1 < prc2) {
                        if(leg1_is_buy)
                            credit_spread = true
                        else credit_spread = false
                    }

                    let break_even, max_profit, max_loss
                    if(credit_spread) {
                        let net_credit = Math.abs(prc1-prc2)
                        max_loss = (spread - net_credit) * qty
                        max_profit = net_credit * qty
                        break_even = strike2 - net_credit
                    } else {
                        let net_debit = Math.abs(prc1-prc2)
                        max_profit = (spread - net_debit) * qty
                        max_loss = net_debit * qty
                        break_even = strike1 - net_debit
                    }

                    print_cell.html( (credit_spread?"Credit Spread": "Debit Spread") + "<br>Max profit = " + max_profit.toFixed(1) + "</br> Max loss = " + max_loss.toFixed(1) + "</br> Break-even=" + break_even.toFixed(0))
                }
            } else {
                print_cell.html("")
            }
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
                position = $(`#at-pool tr[token=${token}][exch=${exch}][qty=${qty}]`)     //Search by attribute value [trtype=${trtype}]
            else if(broker.name === "kite")
                position = $(`#at-pool tr[instrument_token=${token}][exch=${exch}][qty=${qty}]`)    //[trtype=${trtype}]
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
                    buy_sell = '<span class="badge bg-success">Buy</span><br>'
                    trtype='B'
                } else {
                    buy_sell = '<span class="badge bg-danger">Sell</span><br>'
                    trtype='S'
                }
                pos.trantype = trtype;
                let ttype = orderbook.know_bull_or_bear(pos)
                qty = (qty < 0)? -1 * qty:qty; // Make it positive if it is negative
                let dname = (pos.dname != undefined) ? pos.dname : pos.tsym;

                if(qty >0) {
                    console.log("Open position : ", JSON.stringify(pos))

                    let ticker = broker.get_ticker(pos)
                    let position = trade.getTradePosition(ticker, pos.exch, trtype, qty);
                    if(position.length == 0) { //Add new position only if it doesn't exist
                        console.log("Position doesn't exist in active trades. So adding it..")

                        let className= (ttype==="bear")?"table-danger":" ";
                        let tbody_elm = $('#at-pool');
                        let margin_used = (pos.netavgprc * qty).toFixed(2);

                        tbody_elm.append(`<tr id="row_id_${++unique_row_id}" class="${className}" exch="${pos.exch}" token="${ticker}" instrument_token="${ticker}" tsym="${pos.tsym}" qty="${qty}" ttype="${ttype}" trtype="${trtype}" prd="${pos.prd}" trade="active" margin="${margin_used}">
                            <td> <input type="checkbox" class="select_box" value="" onclick="client_api.util.uncheck(this)"> </td>
                            <td>${buy_sell + ticker}</td>
                            <td class="instrument">${dname}</td>
                            <td class="entry num">
                                <span class="price" title="Margin Used : ${margin_used}" ondblclick="client_api.trade.edit_entry_price(this)">${pos.netavgprc}</span>
                            </td>
                            <td class="trade_${ticker} ltp">${pos.lp}</td>
                            <td class="pnl"></td>
                            <td><input type="text" disabled class="form-control target" placeholder="" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></td>
                            <td><input type="text" disabled class="form-control sl" placeholder="" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></td>
                            <td><input type="text" class="form-control exit-limit" placeholder="" ondblclick="client_api.watch_list.add_ltp(this); $(this).unbind('click');" onkeydown="client_api.util.handle_limit_exit(event, this, $(this).parent().parent().find('.exit'))"></td>
                            <td><input type="text" class="form-control qty" placeholder=""  value="${qty}"></td>
                            <td><button type="button" class="btn btn-success modify" onclick="client_api.trade.modify(this, $(this).text())">Edit</button></td>
                            <td><button type="button" class="btn btn-danger exit" onclick="client_api.trade.exit(this)">Exit</button></td>
                        </tr>`);
                        /*${live_data[ticker]}*/

                        trade.update_total_margin(tbody_elm);
                    }else {
                        console.log("Position is already present in active trades")
                    }
                }
            }
        },

        exit_all_positions : function(kill_switch_btn) {
            console.log("KILL SWITCH pressed")
            if(!is_paper_trade()) {
                $('#open_orders tr').each(function (index, tr_elm) {
                    $(tr_elm).find('.cancel').click()
                })
            }

            trade.close_all_trades()
            setTimeout(function(btn) {$(btn).removeAttr('disabled')}, 5000, kill_switch_btn)
        },

        exit_at_eom : function() {  //Exit @ End of market hours, i.e. @ 3:20 PM
            var now = new Date();
            var timeDiff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 20, 0, 0) - now;
            if (timeDiff > 0) {
                trade.exit_handler = setTimeout(function () {
                    trade.close_all_trades();
                    lib.show_success_msg("Exited all positions")
                }, timeDiff);
            }
        },

        edit_entry_price : function(entry_elm) {
            entry_elm = $(entry_elm)
            let className = entry_elm.attr('class')
            let td_elm = entry_elm.parent();

            var inputElement = $('<input>', {
                type: 'text',
                value: entry_elm.text(),
                class: 'edit-input form-control'
            });

            entry_elm.replaceWith(inputElement);
            inputElement.keydown( function(event) {event.key == "Enter"? inputElement.blur():""});  //On press of Enter save the input
            inputElement.focus();
            inputElement.select()

            inputElement.on('blur', function() {
                var newSpan = $('<span>', {
                    class: className,
                    text: inputElement.val()
                });

                td_elm.on('dblclick', 'span.price', function() {client_api.trade.edit_entry_price(newSpan)});
                inputElement.replaceWith(newSpan);
            });
        },

        swap_entry_exit: function(span_elm) {
            let buy_sell = $(span_elm).text();
            let row_elm = $(span_elm).parent().parent();
            let entry_elm = row_elm.find('.entry').find('.price');
            let exit_elm = row_elm.find('.exit-price');

            if(buy_sell.toUpperCase() == "BUY") {
                $(span_elm).removeClass("bg-success");
                $(span_elm).addClass("bg-danger");
                $(span_elm).text("Sell");
                row_elm.attr("trtype", "S")
            } else if(buy_sell.toUpperCase() == "SELL") {
                $(span_elm).addClass("bg-success");
                $(span_elm).removeClass("bg-danger");
                $(span_elm).text("Buy");
                row_elm.attr("trtype", "B")
            }
            let ttype = row_elm.attr("ttype")
            row_elm.attr('ttype', (ttype==="bull"? "bear": "bull"))
            let entry_price = entry_elm.text();
            let exit_price = exit_elm.text();
            entry_elm.text(exit_price);
            exit_elm.text(entry_price);
        }
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

            if(count == 0) lib.show_error_msg("No instrument is selected")

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
                if (optt === "PE" && (params.exch === "NFO" || params.exch === "BFO")) {
                    params.put_option = true
                }
                if(!this.already_exists(params.token)) {
                    watch_list.add_row_to_watch(params)
                } else {
                    lib.show_success_msg(params.sym + " is already present")
                }
            } else {
                lib.show_error_msg("Please select an instrument from the drop down")
            }
        },

        already_exists(token) {
            let found = false;
            $('#watch_list_body').find("td.token").each(function(index, td) {
                if(token === $(td).text()) {
                    found = true;
                }
            })
            return found;
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
            } else if(tsym.startsWith('BANKEX') || tsym.startsWith('SENSEX')) {
                //BANKEX2460358300PE or BANKEX24JUN58300CE = tsym         dname = undefined
                dname = this.parseTsymBankex(tsym)
            }

            return dname
        },

        parseTsymBankex : function(tsym) {
            const instrumentName = tsym.slice(0, 6); // Extract the fixed instrument name "BANKEX"
            const year = tsym.slice(6, 8); // Extract the year (2 characters)

            let dateOrMonth, price, optionType;
            const monthMap = {
                '1': 'JAN',
                '2': 'FEB',
                '3': 'MAR',
                '4': 'APR',
                '5': 'MAY',
                '6': 'JUN',
                '7': 'JUL',
                '8': 'AUG',
                '9': 'SEP',
                '10': 'OCT',
                '11': 'NOV',
                '12': 'DEC'
            };

            // Check if the 9th character (index 8) is a digit (for month 1-9) or a letter (for month abbreviation)
            if (isNaN(tsym.charAt(8))) {
                // It's a month abbreviation (like JUN)
                dateOrMonth = tsym.slice(8, 11);
                price = tsym.slice(11, -2); // Price starts after month and ends 2 characters before the end
            } else {
                // It's a date with month (e.g., 603)
                const month = tsym.charAt(8); // Single digit month
                const day = tsym.slice(9, 11); // Two digit day
                const monthAbbreviation = monthMap[month]; // Convert month digit to abbreviation
                dateOrMonth = day + ' ' + monthAbbreviation;
                price = tsym.slice(11, -2); // Price starts after date and ends 2 characters before the end
            }

            optionType = tsym.slice(-2); // The last 2 characters are the option type (CE/PE)

            return instrumentName + " " + dateOrMonth + " " + year + " " + price + " " + optionType;

            //BANKEX2460358300PE { instrumentName: 'BANKEX', year: '24', dateOrMonth: '03 JUN', price: '58300', optionType: 'PE' }
            //BANKEX24JUN58300CE { instrumentName: 'BANKEX', year: '24', dateOrMonth: 'JUN', price: '58300', optionType: 'CE' }
        },

        add_row_to_watch : function(params) {
            let sym_token = broker.get_subscribe_token(params);

            console.log("Add row to watch .. ", sym_token)
            broker.subscribe_token(sym_token);

            //Add to watched items
            watch_list.watched_items[`${params.exch}_${params.token}`] = JSON.stringify(params)
            watch_list.save_watch_list()

            let class_name = ''
            if(params.put_option) {
                class_name = 'table-danger'
            }

            let ticker = broker.get_ticker(params);

            $('#watch_list_body').append(`<tr class="${class_name}" exch="${params.exch}" token="${params.token}" instrument_token="${params.instrument_token}" tsym="${params.tsym}" lot_size="${params.lot_size}" dname="${params.sym}">
    
                <td> <input type="checkbox" class="select_box" value="" onclick="client_api.util.uncheck(this)"> </td>
                <td class="dname">${params.sym}</td>
                <td class="token">${ticker}</td>
                <td class="margin_req num"></td>
                <td class="watch_${ticker} ltp" lot_size="${params.lot_size}"></td>
                <td class="input_box"><input type="text" class="form-control entry" placeholder="" ondblclick="client_api.watch_list.toggle_ltp(this); $(this).unbind('click');" onkeydown="client_api.util.handle_buy_sell(event, $(this).parent().parent().find('.buy'), $(this).parent().parent().find('.sell'))" title="Market buy: Shift+Enter or Shift+B \nLimit buy: Ctrl+Enter or Ctrl+B \nMarket sell: Shift+S \nLimit sell: Ctrl+S \n"></td>  
                <td class="input_box"><input type="text" class="form-control qty" placeholder="" value="${params.lot_size}"  onkeydown="client_api.util.handle_qty(event, ${params.lot_size})"></td>
                <td><button type="button" class="btn btn-success buy" onclick="client_api.orderbook.buy(this)">BUY</button></td>
                <td><button type="button" class="btn btn-danger sell" onclick="client_api.orderbook.sell(this)">SELL</button></td>
                <td class="del-icon delete" onclick="client_api.watch_list.delete_item(this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </td>
               </tr>`);
        },

        add_ltp : function(input_elm) {
            let row_elm = $(input_elm).parent().parent()
            $(input_elm).val(row_elm.find('.ltp').text())
            // $(input_elm).select();
        },

        toggle_ltp : function(input_elm) {
            let row_elm = $(input_elm).parent().parent()
            let cur_val = $(input_elm).val().trim().toUpperCase();
            let new_val = '';
            if(cur_val == '') {
                new_val = row_elm.find('.ltp').text();
            } else if(/^[0-9]+/.test(cur_val)) { //If it contains spot based value, then toggle to LTP and vice versa
                let tsym = row_elm.attr("tsym");
                if(tsym.startsWith("NIFTY")) {
                    new_val = `N ${parseInt(live_data[nifty_tk])}`
                } else if(tsym.startsWith("BANKNIFTY")) {
                    new_val = `B ${parseInt(live_data[bank_nifty_tk])}`
                } else if(tsym.startsWith("FIN")) {
                    new_val = `F ${parseInt(live_data[fin_nifty_tk])}`
                } else if(tsym.startsWith("BANKEX")) {
                    new_val = `K ${parseInt(live_data[bankex_tk])}`
                } else if(tsym.startsWith("SEN")) {
                    new_val = `S ${parseInt(live_data[sensex_tk])}`
                } else if(tsym.startsWith("MID")) {
                    new_val = `M ${parseInt(live_data[midcap_nifty_tk])}`
                }
            } else {
                new_val = '';
            }

            $(input_elm).val(new_val)
            // $(input_elm).select();
        },

        delete_item : function(th_elm) {
            let tr_elm = $(th_elm).parent();
            let exch = tr_elm.attr('exch')
            let token = tr_elm.attr('token')

            delete watch_list.watched_items[`${exch}_${token}`]
            watch_list.save_watch_list()

            tr_elm.remove();
        },

        handle_keys : function(e, input) {
            if(e.code == "Space") {         // On pressing spacebar, auto completes based on spot values for nifty, bank nifty and fin nifty
                let val = $(input).val().toLowerCase();
                val = val.replace(/[\s+-_]/, ""); // replace multiple spaces and - and _ with ''
                let spot, round;
                if(val == "ban" || val == "bank" || val== "banknifty") {
                    spot = live_data[bank_nifty_tk];
                    round = conf['bank_nifty'].round_to;
                    spot = Math.round(spot/round) * round
                    $(input).val("Banknifty " + spot)
                } else if(val == "nif" || val == "nift" || val == "nifty") {
                    spot = live_data[nifty_tk];
                    round = conf['nifty'].round_to;
                    spot = Math.round(spot/round) * round
                    $(input).val("Nifty " + spot)
                } else if(val == "fin" || val == "finnifty") {
                    spot = live_data[fin_nifty_tk];
                    round = conf['fin_nifty'].round_to;
                    spot = Math.round(spot/round) * round
                    $(input).val("Finnifty " + spot)
                } else if(val == "mid" || val == "midc" || val == "midcap") {
                    spot = live_data[midcap_nifty_tk];
                    round = conf['midcap_nifty'].round_to;
                    spot = Math.round(spot/round) * round
                    $(input).val("MIDCPNIFTY " + spot)
                } else if(val == "se" || val == "sen" || val == "sens" || val == "sensex") {
                    spot = live_data[sensex_tk];
                    round = conf['sensex'].round_to;
                    spot = Math.round(spot/round) * round
                    $(input).val("sensex " + spot)
                } else if(val == "bx" || val == "bankex" ) {
                    spot = live_data[bankex_tk];
                    round = conf['bankex'].round_to;
                    spot = Math.round(spot/round) * round
                    $(input).val("bankex " + spot)
                }
            } else if(e.ctrlKey && e.key.toLowerCase() == "x") {  // Ctrl + x  clears input
                $(input).val("")
            }  else if(e.ctrlKey && e.key.toLowerCase() == "a") {  // Ctrl + a  selects input
                $(input).select();
            } else if(e.key == 'Escape') {
                $(input).blur()
            }
        },

        search : {
            attach_keyboard_shortcuts: function() {
                $("input.search-instrument").keydown(function(event) {
                    let list = $('#instr-drop-down').find('ul')
                    if(event.keyCode == 40) { //Down arrow pressed
                        let selected = list.find('.selected')
                        if(selected.length == 0) {
                            list.find('li').first().addClass('selected')
                        } else {
                            selected.removeClass('selected')
                            selected.next().addClass('selected')
                        }
                        // $("input.search-instrument").text(list.find('.selected').text())
                    } else if (event.keyCode == 38) { // Up arrow pressed
                        let list = $('#instr-drop-down').find('ul')
                        let selected = list.find('.selected')
                        if(selected.length == 0) {
                            list.find('li').first().addClass('selected')
                        } else {
                            selected.removeClass('selected')
                            selected.prev().addClass('selected')
                        }
                        // $("input.search-instrument").text(list.find('.selected').text())
                    } else if(event.key == "Enter") {
                        this.select(event, list.find('.selected')[0])
                        $('#add_to_watchlist').click();
                    }
                })
            }
        }
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

                $('#positions_table').append(`<tr class="${cls}" exch="${item.exch}" token="${item.token}" instrument_token="${item.instrument_token}" tsym="${item.tsym}" lot_size="${item.ls}">
                        <td> <input type="checkbox" class="select_box" value="" onclick="client_api.util.uncheck(this)"> </td>
                        <td class="text dname">${dname}</td>
                        <td class="num">${urmtm}</td>
                        <td class="num rpnl">${rpnl}</td>
                        <td class="buy_price">${item.daybuyavgprc}</td>
                        <td class="sell_price">${item.daysellavgprc}</td>
                        <td class="buy_qty">${item.daybuyqty}</td>
                        <td class="sell_qty">${item.daysellqty}</td>
                        <td class="pos_${ticker} num ltp">${item.lp}</td>
                        <td class="prd">${prd}</td>
                        <td class="num margin">${item.daybuyamt}</td>
                        <td class="num">${item.daysellamt}</td>
                        <td class="num">${item.dayavgprc}</td>
                        <td class="num netqty">${item.netqty}</td>
                        <td class="num">${item.netavgprc}</td>
                        <td>${item.exch}</td>
                </tr>`);
            }
        },

        load_closed_positions: function(tbody_selector) {
            if($(`${tbody_selector} input:checkbox:checked`).length > 0) {
                $(`${tbody_selector} input:checkbox:checked`).each(function () {
                    let row_elm = $(this).parent().parent()

                    let pos = positions.map_row_to_position(row_elm);
                    let ret = positions.display_closed_trade(pos);      //Returns true if the position is loaded, else returns false

                    // this.checked = !ret;        //Uncheck the checkbox only if loaded.. Otherwise leave it as it is
                    this.checked = false
                })
                $(tbody_selector).parent().find('thead input:checkbox')[0].checked = false; //uncheck parent checkbox

                trade.update_total_margin($('#at-pool'))  // Update pool's margin
                $('#notify-at-pool').html('')             // Remove the alert on grouping
            } else {
                lib.show_error_msg("No position is selected")
            }
        },

        map_row_to_position : function(tr_elm) {
            tr_elm = $(tr_elm)
            let std_pos = {
                'exch': tr_elm.attr('exch'),
                'token': tr_elm.attr('token'),
                'instrument_token': tr_elm.attr('instrument_token'),
                'tsym': tr_elm.attr('tsym'),
                'netqty': tr_elm.find('.netqty').html(),
                'buyqty': tr_elm.find('.buy_qty').html(),
                'sellqty': tr_elm.find('.sell_qty').html(),
                'netavgbuyprc': tr_elm.find('.buy_price').html(),
                'netavgsellprc': tr_elm.find('.sell_price').html(),
                'margin': tr_elm.find('.margin').html(),
                'dname': tr_elm.find('.dname').html(),
                'rpnl': tr_elm.find('.rpnl').find('span').html(),
                'prd': tr_elm.find('.prd').html(),
            }
            return std_pos;
        },

        display_closed_trade :function(pos) {
            // let buy_sell = '<span class="badge bg-success">Buy</span>'      //Use buy as default.. we don't know once the position is closed, whether it was buy or sell
            let trtype='B'
            let buyqty = parseFloat(pos.buyqty), sellqty = parseFloat(pos.sellqty)
            let open_qty = Math.abs( buyqty - sellqty );
            let closed_qty = open_qty>0? (Math.max(buyqty, sellqty) - open_qty): buyqty;
            pos.trantype = trtype;
            let ttype = orderbook.know_bull_or_bear(pos)
            let dname = (pos.dname != undefined) ? pos.dname : pos.tsym;
            let pnl_cls = parseFloat(pos.rpnl)<0 ? "neg-mtm" : "pos-mtm";

            console.log("Loading closed position : ", JSON.stringify(pos))
            let ticker = broker.get_ticker(pos);
            let position = trade.getTradePosition(ticker, pos.exch, trtype, closed_qty);

            /*Subscribe so that LTP can be shown and it can be watched*/
            let sym_token = broker.get_subscribe_token(pos);
            broker.subscribe_token(sym_token);

            if (position.length == 0 && closed_qty > 0) { //Add new position only if it doesn't exist
                console.log("Closed position doesn't exist in active trades. So adding it..")

                let className = "table-secondary";
                let tbody_elm = $('#at-pool');
                let margin_used = (pos.netavgbuyprc * closed_qty).toFixed(2);

                tbody_elm.append(`<tr id="closed_${++unique_row_id}" class="${className}" exch="${pos.exch}" token="${ticker}" instrument_token="${ticker}" tsym="${pos.tsym}" qty="${closed_qty}" ttype="${ttype}" trtype="${trtype}" prd="${pos.prd}" trade="closed" margin="${margin_used}">
                    <td> <input type="checkbox" class="select_box" value="" onclick="client_api.util.uncheck(this)"> </td>
                    <td>Closed<br><span class="badge badge-pill bg-success" onclick="client_api.trade.swap_entry_exit(this)">Buy</span> <br> ${ticker}</td>
                    <td>${dname}</td>
                    <td class="entry num">
                        <span class="price" title="Margin Used : ${margin_used}" ondblclick="client_api.trade.edit_entry_price(this)">${pos.netavgbuyprc}</span>
                    </td>
                    <td class="trade_${ticker} ltp">${pos.lp}</td>
                    <td class="pnl ${pnl_cls}">${pos.rpnl}</td>
                    <td><input type="text" disabled class="form-control target" placeholder="" ></td>
                    <td><input type="text" disabled class="form-control sl" placeholder="" ></td>
                    <td><span class="price exit-price" ondblclick="client_api.trade.edit_entry_price(this)">${pos.netavgsellprc}</span>
                    </td>
                    <td><input type="text" class="form-control qty" placeholder=""  value="${closed_qty}"></td>
                    
                    <td>CLOSED<br><span class="badge badge-pill bg-secondary" title="Watch live" onclick="client_api.trade.toggle_watch_closed_trade($(this))" style="cursor:pointer;padding:8px;margin-top:10px">Watch</span></td>
                    <td><button type="button" class="btn btn-dark btn-sm delete" onclick="client_api.trade.delete(this)">Delete</button></td>
                </tr>`);

                trade.update_total_margin(tbody_elm);
                return true;
            } else {
                let msg = closed_qty>0 ? "Position is already present in active trades": "The position is still open.Try loading it through active trades button"
                lib.show_success_msg(msg)
                return false;
            }
        },
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
            cascade_exits: [],

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

            toggle_cascade_exit : function(btn, group_id) {
                if($(btn).hasClass('btn-dark')) {
                    $(btn).removeClass('btn-dark')
                    $(btn).addClass('btn-light')
                    $(btn).attr("title", "Cascade exit is turned OFF");
                } else {
                    $(btn).addClass('btn-dark')
                    $(btn).removeClass('btn-light')
                    $(btn).attr("title", "Cascade exit is turned ON");
                }
                this.toggle_cascade(group_id)
            },

            toggle_cascade(group_id) {
                const index = this.cascade_exits.indexOf(group_id);
                if (index !== -1) {
                    // If the group_id exists, remove it
                    this.cascade_exits.splice(index, 1);
                } else {
                    // If the group_id doesn't exist, add it
                    this.cascade_exits.push(group_id);
                }
            },

            is_cascade_exit_enabled(group_id) {
                return this.cascade_exits.includes(group_id);
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

                    trade.update_total_margin(tbody_elm)      // Update group's margin
                    trade.update_total_margin($('#at-pool'))  // Update pool's margin as well
                    $('#notify-at-pool').html('')             // Remove the alert on grouping

                    if($('#at-pool').children().length === 0) {
                        let parent_checkbox = $('#at-pool').parent().find('thead input:checkbox');
                        parent_checkbox[0].checked = false;
                    }

                    trade.calculate_spreads(tbody_elm, $(`#summary-at-${group.name} .max-profit-loss`));
                    $('#summary-at-pool .max-profit-loss').html(""); //Reset debit-credit spread calculations
                    trade.reset_max_profit_loss('at-pool');
                    $('#group_name').val(''); //Reset group name
                } else {
                    lib.show_error_msg("No position is selected")
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
                    } else {
                        $(`#summary-${tbody_selector} .max-profit-loss`).html(""); //Reset debit-credit spread calculations
                    }
                    trade.calculate_spreads($('#at-pool'), $('#summary-at-pool .max-profit-loss'));

                    trade.update_total_margin($(tbody_selector))      // Update group's margin
                    trade.update_total_margin($('#at-pool'))  // Update pool's margin as well
                    $('#notify-at-pool').html('')             // Remove the alert on grouping
                } else {
                    lib.show_error_msg("No position is selected")
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
                if($(group_selector).find('tr[trtype="S"]').length > 0) {       // Both buy and sell positions are present. Close the sell positions first, then buy positions
                    $(group_selector).find('tr[trtype="S"]').each(function (){ close(this);})
                    setTimeout(function() {
                        $(group_selector).find('tr[trtype="B"]').each(function () {close(this);})
                    }, 500);
                } else
                    $(group_selector).find('tr[trtype="B"]').each(function () {close(this);})       //Only buy positions are present

                if(count == 0)
                    lib.show_error_msg("No position selected to exit")

                function close(row) {
                    let checkbox = $(row).find('.select_box')[0];
                    if(checkbox.checked || target_sl_triggered) {
                        count++;
                        $(row).find('.exit').click();
                    }
                }
            },

            create_table : function(group, class_name) {
                $('#active_trades_div').append(`<div group="${group.id}" class="group-container">
                    <div>
                        <button class="btn btn-secondary mb-3" onclick="client_api.util.grouping.ungroup_selected('#${group.id}')" style="margin-left:10px;">Ungroup Selected</button>
                        <button class="btn btn-light mb-3 cascade-exit" title="Exit all the trades in the group if SL or Target is hit for any one" onclick="client_api.util.grouping.toggle_cascade_exit(this, '${group.id}')">Cascade Exit</button>
                        <button class="btn btn-danger mb-3" onclick="client_api.util.grouping.exit_group('#${group.id}')">Exit</button>
                        <span class="del-icon" onclick="client_api.util.grouping.delete('#${group.id}')" title="Delete the closed trades" style="position: relative; top:-7px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="32" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                        </span>
                        <h5 class="group-name">${group.name.toUpperCase()}</h5>
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
                            <th scope="col" id="notify-${group.id}"></th>
                            <th scope="col"></th>
                            <th scope="col" class="max-profit-loss"></th>
                            <th scope="col">${group.name.toUpperCase()}</th>
                            <th>Total</th>
                            <th scope="col" class="pnl" id="pnl-${group.id}"></th>
                            <th><input type="text" disabled class="form-control target" placeholder="" value="" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></th>
                            <th><input type="text" disabled class="form-control sl" placeholder="" value="" ondblclick="client_api.watch_list.toggle_ltp(this);" onkeydown="client_api.util.handle_enter_key(event, $(this).parent().parent().find('.modify'))"></th>
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
        },

        handle_enter_key : function(event, btn) {
            if(event.key == "Enter") {
                btn.click();
                $(event.srcElement).blur();
            }
        },

        handle_entry : function(event, input, btn) {
            if(event.key == "Enter" && event.ctrlKey) { // Enter with Market order for CTRL + ENTER
                $(input).val("")
                btn.click();
                $(event.srcElement).blur();
            } else if(event.key == "Enter") {
                btn.click();
                $(event.srcElement).blur();
            }
        },


        handle_buy_sell : function(event, buy_btn, sell_btn) {
            let input = event.srcElement;

            // Market buy - Shift + Enter or Shift + B
            if (event.shiftKey && event.key == "Enter" || event.shiftKey && event.key.toLowerCase() == "b") {
                buy_btn.click();
                $(input).blur();
            }

            //Limit Buy - CTRL + Enter or CTRL+B
            else if(event.ctrlKey && event.key == "Enter" || event.ctrlKey && event.key.toLowerCase() == "b") {
                let lim = $(input).val()
                if (lim == null || lim == "") {
                    client_api.watch_list.add_ltp(input)
                }
                buy_btn.click();
                $(input).blur();
            }

            // Market sell - Shift + S
            else if (event.shiftKey && event.key.toLowerCase() == "s") {
                sell_btn.click();
                $(input).blur();
            }
            //Limit Sell - CTRL + S
            else if(event.ctrlKey && event.key.toLowerCase() == "s") {
                let lim = $(input).val()
                if (lim == null || lim == "") {
                    client_api.watch_list.add_ltp(input)
                }
                sell_btn.click();
                $(input).blur();
            }

            else if(event.key == "Enter") { //If there is a limit price entered and Enter button is pressed it triggers limit buy
                let lim = $(input).val()
                if (lim != null && lim != "") {
                    buy_btn.click();
                    $(input).blur();
                }
            }

            // If up or down arrow is pressed, move the price up or down
            else if(event.key == "ArrowUp") {
                let price = parseInt($(input).val())
                if (isNaN(price) || price == "") {
                    price = parseInt($(input).parent().parent().find(".ltp").html())
                }
                $(input).val(price + 1)
            } else if(event.key == "ArrowDown") {
                let price = parseInt($(input).val())
                if (isNaN(price) || price == "") {
                    price = parseInt($(input).parent().parent().find(".ltp").html())
                }
                if(price > 1)
                    $(input).val(price - 1)
            }
        },

        handle_qty : function(event, lot_size) {
            if(event.key == "ArrowUp") {
                let qty = parseInt($(event.srcElement).val())
                $(event.srcElement).val(qty + lot_size)
            } else if(event.key == "ArrowDown") {
                let qty = parseInt($(event.srcElement).val())
                if(qty > lot_size)
                    $(event.srcElement).val(qty - lot_size)
            }
        },

        handle_limit_exit : function(event, input, btn) {
            if(event.key == "Enter") {
                let lim = $(input).val()
                if (lim == null || lim == "") {
                    client_api.watch_list.add_ltp(input)
                }
                btn.click();
                $(event.srcElement).blur();
            }
        },

    };

    const toggle_exit_at_eom = function() {
        let exit_on = document.getElementById('exit_at_eom').checked == false
        if(exit_on) {
            client_api.trade.exit_at_eom();
        } else {
            clearTimeout(client_api.trade.exit_handler);
            delete trade.exit_handler
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
        select_broker();
        broker.init();
        broker.connect();
        broker.search.attach_search_autocomplete();
        setTimeout(client_api.orderbook.update_open_orders, 100);
        setTimeout(client_api.trade.load_open_positions, 100);
        setTimeout(client_api.watch_list.restore_watch_list, 100);
        setTimeout(client_api.trade.trigger, 1000);
    }

    function load_login_creds_from_conf() {
        $('#login-creds').find('.shoonya-creds').find('.user-id').val(conf.broker['shoonya'].user_id);
        $('#login-creds').find('.shoonya-creds').find('.session-token').val(conf.broker['shoonya'].session_token);
        $('#login-creds').find('.kite-creds').find('.user-id').val(conf.broker['kite'].user_id);
        $('#login-creds').find('.kite-creds').find('.session-token').val(conf.broker['kite'].session_token);
    }

    /*Attach functions to connect, add to watch list button, etc*/
    $(document).ready(function() {
        load_login_creds_from_conf();
        select_broker();
        hide_other_tabs('#open_orders')
        setInterval(lib.updateClock, 1000);
    });

    return {
        "util": util,
        "watch_list": watch_list,
        "orderbook": orderbook,
        "trade" : trade,
        "positions" : positions,
        "subscribed_symbols": subscribed_symbols,
        "live_data": live_data,
        "mgr": milestone_manager,
        "order_mgr" : open_order_mgr,
        "lib.show_success_msg" : lib.show_success_msg,
        "lib.show_error_msg" : lib.show_error_msg,
        "toggle_paper_trade": toggle_paper_trade,
        "toggle_exit_at_eom" : toggle_exit_at_eom,
        "connect_to_server" : connect_to_server,
        "select_broker" : select_broker,
        "conf": conf,
    }

}();

$(document).ready(function() {
    $('button.close-btn').on('click', function (event) {
        event.preventDefault();
        $(this).parent().hide();
    });

    document.addEventListener('keydown', function (event) {
        if(event.ctrlKey && event.key.toLowerCase() == "s") { // Ctrl + S, focuses on search box for instrument
            event.preventDefault();
            $('input.search-instrument').focus();
        }
    })

    $("#watch_list_body").sortable({
        // items: 'tr:not(tr:first-child)',
        items: 'tr',
        dropOnEmpty: false,
        start: function (G, ui) {
            ui.item.addClass("select");
        },
        stop: function (G, ui) {
            ui.item.removeClass("select");
        }
    });

    /* Uncomment this code to make the rows in the active trade to be draggable
    $("#at-pool").sortable({
        items: 'tr:not(tfoot tr, thead tr, tr.summary)',
        dropOnEmpty: false,
        start: function (G, ui) {
            ui.item.addClass("select");
        },
        stop: function (G, ui) {
            ui.item.removeClass("select");
        }
    });*/
});


