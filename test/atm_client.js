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

        search: {
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

        atm_strike : {},

        identify_atm_strike : function(instrument) {
            let mod = Math.round(live_data[nifty_tk]%100);
            if(mod < 50)
                this.atm_strike[instrument] = Math.floor(this.get_ltp(instrument)/100) * 100;
            else
                this.atm_strike[instrument] = Math.ceil(this.get_ltp(instrument)/100) * 100;
        },

        get_ltp: function(instrument) {
            switch(instrument) {
                case 'nifty': return live_data[nifty_tk]; break;
                case 'bank_nifty': return live_data[bank_nifty_tk]; break;
                case 'fin_nifty': return live_data[fin_nifty_tk]; break;
                default : return NaN; break;
            }
        }
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

    function connect_to_server(){
        select_broker()
        broker.init();
        broker.connect();
        broker.search.attach_search_autocomplete();

        //Uncomment below line to enable spreads dynamic calculation
        // setTimeout(trade.calculate_spreads, 2000);
    }

    return {
        "subscribed_symbols": subscribed_symbols,
        "live_data": live_data,
        "show_success_msg" : show_success_msg,
        "show_error_msg" : show_error_msg,
        "connect_to_server" : connect_to_server,
        "select_broker" : select_broker,
    }

}();


