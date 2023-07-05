client_api = window.client_api || {};

client_api = function () {
    
    let alert_msg_disappear_after = 3000; // Unit milliseconds
    let vix_tk, nifty_tk, bank_nifty_tk, fin_nifty_tk = '';
    let user_id = '', session_token='', ws = '';
    let subscribed_symbols = []
    let pending_to_subscribe_tokens = new Set();
    let logged_in = false;
    let heartbeat_timeout = 7000;
    let live_data = {};
    let broker = '';

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
            $('#connection_status').css('color', 'green')
        } else {
            logged_in = false
            $('#connection_status').css('color', 'red')
        }
    }

    let shoonya = {
        name : "shoonya",

        url : {
            websocket : "wss://trade.shoonya.com/NorenWSWeb/",
            search_instrument : "https://trade.shoonya.com/NorenWClientWeb/SearchScrip",
            order_book : "https://trade.shoonya.com/NorenWClientWeb/OrderBook",
            place_order : "https://trade.shoonya.com/NorenWClientWeb/PlaceOrder",
            modify_order : "https://trade.shoonya.com/NorenWClientWeb/ModifyOrder",
            cancel_order : "https://trade.shoonya.com/NorenWClientWeb/CancelOrder",
            exit_order : "https://trade.shoonya.com/NorenWClientWeb/ExitOrder",
            positions : "https://trade.shoonya.com/NorenWClientWeb/PositionBook",
        },

        init : function() {
            vix_tk = '26017', nifty_tk = '26000', bank_nifty_tk = '26009', fin_nifty_tk = '26037';
            subscribed_symbols = ["NSE|26017", "NSE|26000", "NSE|26009", "NSE|26037"];
        },

        connect: function() {
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
                    if(ws.readyState == WebSocket.OPEN) {
                        var _hb_req = '{"t":"h"}';
                        ws.send(_hb_req);
                    }
                }, heartbeat_timeout);
            };

            ws.onmessage = function (event) {
                result = JSON.parse(event.data)
                if(result.t == 'ck') {
                    if (result.s == 'OK') {
                        // console.log('On message : ck OK')
                        subscribed_symbols.forEach(shoonya.subscribe_token)
                    }
                }
                if( result.t == 'tk' || result.t == 'tf') {
                    // console.log('On message : ' + result.t)
                    if(result.lp != undefined) {
                        let instr_token = result.tk
                        let ltpf = parseFloat(result.lp).toFixed(2)
                        live_data[instr_token] = ltpf
                        update_ltps(instr_token, ltpf)
                    }
                }
                if( result.t == 'dk' || result.t == 'df') {
                    console.log('On message : ' + result.t)
                    // trigger("quote", [result]);
                }
                if(result.t == 'om') {
                    console.log('On message : ' + result.t)
                    // console.log("..................  OM ...................")
                    // console.log(result)
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

        get_subscribe_token : function(params) {
            return params.exch + '|' + params.token
        },

        get_ticker : function(params) {
            return params.token;
        },

        subscribe_token: function(token) {

            pending_to_subscribe_tokens.add(token);

            for(token of pending_to_subscribe_tokens.keys()) {
                let symtoken = {"t": "t", "k": token.concat('#')}
                if (ws.readyState != WebSocket.OPEN) {
                    console.log("Web socket not ready yet.. ", token)
                    setTimeout(function () {
                        shoonya.subscribe_token(token)
                    }, 100)

                } else {
                    console.log("Web socket is ready.. Subscribing ", token)

                    ws.send(JSON.stringify(symtoken));
                    if(!subscribed_symbols.includes(token))
                        subscribed_symbols.push(token);
                    pending_to_subscribe_tokens.delete(token);
                }
            }
        },

        get_positions : function (success_cb) {

            let values          = {};
            values["uid"]       = user_id   ;
            values["actid"]     = user_id   ;

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

        get_orderbook : function(success_cb) {
            let values          = {};
            values["uid"]       = user_id ;
            let payload = shoonya.get_payload(values)
            $.ajax({
                url: broker.url.order_book,
                type: "POST",
                dataType: "json",
                data: payload,
                success: function (data, textStatus, jqXHR) {
                    if(jqXHR.status == 200)
                        login_status(true)

                    for(const[key, order] of Object.entries(data)) {
                        order['subscribe_token'] = shoonya.get_subscribe_token(order)      //Add subscribe_token field.. specific to shoonya
                    }
                    success_cb(data)
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Ajax error : ", JSON.stringify(jqXHR))
                    if(jqXHR.status == 401)
                        login_status(false)
                    show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                }
            });
        },

        get_payload : function(params) {
            let payload = 'jData=' + JSON.stringify(params);
            payload = payload + "&jKey=" + session_token;
            return payload
        },

        post_request : function(url, params, success_cb, failure_cb) {
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

        cancel_order : function(tr_elm, orderno, success_cb) {
            let values            = {'ordersource':'WEB'};
            values["uid"]         = user_id;
            values["norenordno"]  = orderno;

            shoonya.post_request(broker.url.cancel_order, values, function (data) {
                if (data.stat.toUpperCase() === "OK")
                    tr_elm.remove();

                if ( data.result != undefined) {
                    let orderno = data.result;  //For cancel order, order-id is contained in result variable
                    broker.get_orderbook(success_cb)
                }
            });
        },

        modify_order : function(tr_elm, entry_obj, success_call_bk) {
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

            shoonya.post_request(broker.url.modify_order, values, function(data) {
                if(data.stat == "Ok") {
                    let orderno = data.result;  // In case of modify and cancel order 'result' contains order ID.
                    data.orderno = orderno
                    success_call_bk(data)
                    show_success_msg("Order with order num : " + orderno + " modified successfully")
                } else show_error_msg(data.emsg)
            })
        },

        search : {
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
    }
    
    let kite = {
        name : "kite",
        
        url : {
            websocket : "wss://ws.zerodha.com/",
            search_instrument : "https://kite.zerodha.com/oms/",
            order_book : "https://kite.zerodha.com/oms/orders",
            place_order : "https://kite.zerodha.com/oms/",
            modify_order : "https://kite.zerodha.com/oms/orders/",
            cancel_order : "https://kite.zerodha.com/oms/orders/",
            exit_order : "https://kite.zerodha.com/oms/",
            positions : "https://kite.zerodha.com/oms/portfolio/positions",
        },
        
        init : function() {
            vix_tk = 264969, nifty_tk = 256265, bank_nifty_tk = 260105, fin_nifty_tk = 257801;
            subscribed_symbols = [256265, 260105, 257801, 264969, 11040770, 12064770];
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
                    }, 100)
                } else {
                    console.log("Web socket is open.. Subscribing ", token)
                    if (!logged_in) login_status(true)

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
                        return name + " " + (columns[i_strike] == 0 ? '' : columns[i_strike] + " ") + columns[i_instrument_type] + " " + expiry[2] + " " + month + " " + expiry[0]
                }

                const rows = data.split("\n");
                for (const row of rows) {
                    const columns = row.split(",");
                    if (columns[i_name] != undefined) {
                        const name = columns[i_name].replace(/"/g, '');
                        const dname = getDname(name, columns)
                        if (name === "NIFTY" || name === "BANKNIFTY" || name === "FINNIFTY" || columns[i_instrument_type] === "FUT") {
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
                            parsedData.push(obj);
                        }
                    }
                }
                console.log("Total instrument entries loaded : " + parsedData.length)
                return parsedData;
            },

            search_for_key: function (term) {
                let results = []
                for (const row of this.parsedData) {
                    var filterstrings = term.trim().toLowerCase().split(" ");
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
            },

            attach_search_autocomplete : function() {
                /* Search instrument autocomplete */
                $("input.search-instrument").autocomplete({
                    minLength: 2,
                    autoFocus: true,
                    appendTo: '#instr-drop-down',
                    source: function (request, response) {
                        const results = kite.search.search_for_key(request.term)
                        response(results)
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

                    create: function () {
                        $(this).data('ui-autocomplete')._renderItem = function (ul, item) {
                            return $('<li class="dropdown-item">')
                                .append(item.label)
                                .append('</li>')
                                .appendTo(ul); // customize your HTML
                        };
                    }
                });
            },
        },

        get_positions : function (success_cb) {

            $.get({
                url: kite.url.positions,
                dataType: "json",
                headers : {
                    "Authorization" : "enctoken " + session_token,
                },

                success: function (data, textStatus, jqXHR) {
                    success_cb(data)
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.error("Ajax error " + errorThrown)
                    show_error_msg(jqXHR.responseText)
                }
            });
        },

        get_orderbook : function(success_cb) {
            $.get({
                url: kite.url.order_book,
                dataType: "json",
                headers : {
                    "Authorization" : "enctoken " + session_token,
                },
                success: function (data, textStatus, jqXHR) {
                    let orders = kite.map_orders(data.data)
                    success_cb(orders)
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Ajax error : ", JSON.stringify(jqXHR))
                    if(jqXHR.status == 401)
                        login_status(false)
                    show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                }
            });
        },

        get_subscribe_token : function(params) {
            return params.instrument_token;
        },

        get_ticker : function(params) {
            return params.instrument_token;
        },

        map_orders : function(kite_orders) {
            if(kite_orders == undefined)
                return undefined
            let std_orders = []
            for(const [key, kite_order] of Object.entries(kite_orders)) {
                let std_order = {
                    'subscribe_token' : kite_order.instrument_token,
                    'status' : kite.get_std_order_status(kite_order.status),
                    'exch' : kite_order.exchange,
                    'token' : kite_order.instrument_token,
                    'timestamp' : kite_order.order_timestamp.split(' ')[1],
                    'tsym' : kite_order.tradingsymbol,
                    'amo' : kite_order.variety == "amo"? "Yes" : "No",
                    'trantype' : kite_order.transaction_type == "BUY" ? "B" : "S",
                    'qty' : kite_order.quantity,
                    'prc' : kite_order.price,
                    'norenordno' : kite_order.order_id,
                    'dname' : kite_order.tradingsymbol,

                    'prctyp' : kite_order.order_type,
                    'norentm' : kite_order.exchange_timestamp,
                    'exch_time' : kite_order.exchange_timestamp,
                    'reject_reason' : kite_order.status_message,
                    'remarks': undefined,
                    'prd': kite_order.product,
                    'exch_order_id': kite_order.exchange_order_id,

                    //Kite specific
                    'variety' : kite_order.variety,
                }
                std_orders.push(std_order)
            }
            return std_orders;
        },

        get_std_order_status : function(stat) {
            let std = ''
            if(stat.includes('OPEN')){
                std = "OPEN"
            } else if(stat.includes('CANCELLED')) {
                std = "CANCELLED"
            } else if(stat.includes('COMPLETE')) {
                std = "COMPLETE"
            } else if(stat.includes('REJECTED')) {
                std = "REJECTED"
            } else if(stat.includes('REQ RECEIVED')) {
                std = "OPEN"
            }
            return std;
        },

        cancel_order : function(tr_elm, orderno, success_cb) {
            let variety = tr_elm.attr('variety')
            // let url = kite.url.cancel_order + "regular/" + orderno + "?order_id=" + orderno + "&parent_order_id=&variety=regular"
            let url = kite.url.cancel_order + variety + "/" + orderno + "?order_id=" + orderno + "&parent_order_id=&variety=" + variety
            $.ajax( {
                url: url,
                type: "DELETE",
                headers : {
                    "Authorization" : "enctoken " + session_token,
                },
                success : function (data) {
                    if (data.status === "success")
                        tr_elm.remove()

                    if ( data.data.order_id != undefined) {
                        let orderno = data.data.order_id

                        kite.get_orderbook(function(data) {
                            let orders = kite.map_orders(data.data)
                            success_cb(orders)
                        })
                    }
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Ajax error : ", JSON.stringify(jqXHR))
                    if(jqXHR.status == 401)
                        login_status(false)
                    show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                }
            });
        },

        modify_order : function(tr_elm, entry_obj, success_call_bk) {
            let prctyp = 'LIMIT', price = "0.0";
            if (entry_obj.value == '') {
                prctyp = 'MARKET'
            } else price = entry_obj.value;

            let qty = tr_elm.find('.qty').val()
            let order_id = tr_elm.find('.order-num').html()

            let variety = tr_elm.attr('variety')
            let url = kite.url.modify_order + variety + "/" + order_id

            let payload = {
                variety : variety,
                exchange : tr_elm.attr('exch'),
                tradingsymbol : tr_elm.attr('tsym'),
                transaction_type: tr_elm.attr('trtype') == 'B'? 'BUY' : 'SELL',
                order_type: prctyp,
                quantity: qty,
                price: price,
                product: 'CNC',
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
                            show_success_msg("Order with order num : " + orderno + " modified successfully")
                        }
                    } else show_error_msg(data.emsg)
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Ajax error : ", JSON.stringify(jqXHR))
                    if(jqXHR.status == 401)
                        login_status(false)
                    show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                }
            })
        },
    }

    function update_ltp(selector, ltp) {
        $(selector).each(function(i, ltp_elm) {
            $(ltp_elm).text(ltp)

            if(selector.startsWith('#active_trade') || selector.startsWith("#active_paper_trade")) {
                $(ltp_elm).text(ltp)
                let tr_elm = $(ltp_elm).parent();
                if(tr_elm.attr('trade') == 'active') {
                    trade.update_pnl(tr_elm)
                    trade.update_total_pnl()
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
                console.log(instr_token)
                update_ltp('#watch_list_body .watch_' + instr_token, ltp);   //In watch list
                update_ltp("#open_orders .open_order_" + instr_token, ltp)  // In Open Order table
                update_ltp("#active_trades_table .trade_" + instr_token, ltp)  // In Active Trades table
                update_ltp("#active_paper_trades .trade_" + instr_token, ltp)  // In Active Trades table
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
                    buy_sell = '<span class="badge badge-success">' + type + 'Buy</span>'
                } else {
                    buy_sell = '<span class="badge badge-danger">' + type + 'Sell</span>'
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

            let params = this.get_order_params(tr_elm, buy_sell, entry_obj, qty)
            if (entry_obj.spot_based) {
                params.dname = tr_elm.attr('dname')
                this.add_to_spot_order_list(params, entry_val)
            } else {
                console.log("Going to place order " + JSON.stringify(params))
                if(!is_paper_trade()) {
                    shoonya.post_request(shoonya.url.place_order, params, function (data) {
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

                    <td><button type="button" class="btn btn-success modify" onclick="client_api.orderbook.modify_order(this)">Modify</button></td>
                    <td><button type="button" class="btn btn-danger cancel" onclick="client_api.orderbook.cancel_order(this)">Cancel</button></td>
            </tr>`);

            let entry_obj = milestone_manager.get_value_object(entry_val)
            if(entry_obj.spot_based)
                milestone_manager.add_entry(row_id, item.token, ttype, item.trantype, entry_obj);
        },

        update_open_orders : function() {
            hide_other_tabs('#open_orders')
            broker.get_orderbook(function(data) {orderbook.update_open_order_list(data);})
        },

        get_order_params: function(elm, buy_or_sell, entry, qty) {

            let prctyp = 'LMT', price = "0.0";
            let remarks = "";
            let tsym = elm.attr('tsym');
            let dname = elm.attr('dname');
            let token = elm.attr('token');
            let instrument_token = elm.attr('instrument_token');
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
            values["instrument_token"]      = instrument_token;
            values["qty"]       = qty;
            values["dscqty"]    = qty;
            values["prctyp"]    = prctyp       /*  LMT / MKT / SL-LMT / SL-MKT / DS / 2L / 3L */
            values["prc"]       = price;
            values["ret"]       = 'DAY';
            values["remarks"]   = remarks;

            values["amo"] = "Yes";          // TODO - AMO ORDER

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
                broker.cancel_order(tr_elm, orderno, function(orders) {
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

                if(!order_id.includes("Spot")) {  // Modify value order.. Not spot based order

                    broker.modify_order(tr_elm, entry_obj, function(data) {
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
            let limit_value = tr_elm.find('.exit-limit').val()
            let qty = tr_elm.find('.qty').val()

            let buy_sell= tr_elm.attr('trtype') == 'B' ? 'S' : 'B'; // Do the opposite
            let exit_limit = milestone_manager.get_value_object(limit_value);
            let values = orderbook.get_order_params(tr_elm, buy_sell, exit_limit, qty)

            if(!is_paper_trade()) {
                shoonya.post_request(shoonya.url.place_order, values, function (data) {
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

            tr_elm.find('.modify').parent().html(`CLOSED</br><span class="badge badge-pill badge-secondary" title="Watch live" onclick="client_api.trade.toggle_watch_closed_trade($(this))" style="cursor:pointer;padding:8px;margin-top:10px">Watch</span>`);
            tr_elm.find('.exit').parent().html(`<button type="button" class="btn btn-dark btn-sm" onclick="$(this).parent().parent().remove();client_api.trade.reset_max_profit_loss()">Delete</button>`);
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
                broker.get_orderbook(function (orders) {
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
            broker.get_orderbook(function(orders) {
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
                        <td>${item.norentm === undefined? "": item.norentm}</td>
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

            let ticker = broker.get_ticker(order)

            tbody_elm.append(`<tr id="${row_id}" ordid="${order.norenordno}"  exch="${order.exch}" token="${order.token}" instrument_token="${order.instrument_token}" qty="${order.qty}" tsym="${order.tsym}" ttype="${ttype}" trtype="${order.trantype}" trade="active">
                        <td>${buy_sell}</td>
                        <td class="instrument">${dname}</td>
                        <td class="entry" title="Margin Used : ${(order.prc * order.qty).toFixed(2)}">
                            <span class="badge badge-pill badge-dark">${order.norentm.split(" ")[0]}</span>
                            </br><span class="badge badge-info">${order.remarks}</span>
                            <span class="price">${order.prc}</span></br>
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
                } else
                    milestone_manager.remove_target(row_id)

                if(sl != undefined && sl != '' ) {
                    milestone_manager.add_sl(row_id, token, ttype, trtype, milestone_manager.get_value_object(sl))
                } else
                    milestone_manager.remove_sl(row_id)
            }
        },

        exit : function(elm) {
            client_api.orderbook.exit_order(elm);
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
                            <td><button type="button" class="btn btn-success modify" onclick="client_api.trade.modify(this, $(this).text())">Edit</button></td>
                            <td><button type="button" class="btn btn-danger exit" onclick="client_api.trade.exit(this)">Exit</button></td>
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
                    client_api.watch_list.add_row_to_watch(JSON.parse(value_str))
                }
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
    
                <td> <input type="checkbox" class="select" value=""> </td>
                <td class="dname">${params.sym}</td>
                <th class="margin_req num"></th>
                <th class="watch_${ticker} ltp" lot_size="${params.lot_size}"></th>
                <td class="input_box"><input type="text" class="form-control entry" placeholder="" onclick="client_api.watch_list.add_ltp(this); $(this).unbind('click');"></td>  
                <td class="input_box"><input type="text" class="form-control qty" placeholder="" value="${params.lot_size}"></td>
                <td><button type="button" class="btn btn-success buy" onclick="client_api.orderbook.buy(this)">BUY</button></td>
                <td><button type="button" class="btn btn-danger sell" onclick="client_api.orderbook.sell(this)">SELL</button></td>
                <th class="del-icon" onclick="client_api.watch_list.delete_item(this)">
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


        show_positions : function() {
            $('#positions_table').html("")
            hide_other_tabs('#positions')
            broker.get_positions(function(positions) {
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
        setTimeout(client_api.watch_list.restore_watch_list, 100);
        setTimeout(client_api.trade.trigger, 1000);

        //Uncomment below line to enable spreads dynamic calculation
        // setTimeout(trade.calculate_spreads, 2000);
    }

    /*Attach functions to connect, add to watch list button, etc*/
    $(document).ready(function() {
        hide_other_tabs('#open_orders')
    });

    return {
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
        "connect_to_server" : connect_to_server,
        "select_broker" : select_broker,
    }

}();

$(document).ready(function() {
    $('button.close-btn').on('click', function (event) {
        event.preventDefault();
        $(this).parent().hide();
    });
});


