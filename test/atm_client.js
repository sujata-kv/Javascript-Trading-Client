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
            search_strike: function (instrument, strike) {
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
                         let info = data.values[0];
                         let info1 = data.values[1];
                         shoonya.atm_strike_details[instrument] = [
                             {
                                 'optt': info['optt'],
                                 'strike': strike,
                                 'token': 'NFO|' + info['token'],
                                 'tsym': info['tsym'],
                                 'dname': info['dname']
                             },
                             {
                                 'optt': info1['optt'],
                                 'strike': strike,
                                 'token': 'NFO|' + info1['token'],
                                 'tsym': info1['tsym'],
                                 'dname': info1['dname']
                             },
                         ]

                        shoonya.subscribe_token('NFO|' + info['token']);
                        shoonya.subscribe_token('NFO|' + info1['token']);

                        console.log(shoonya.atm_strike_details[instrument])
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.log("Ajax error")
                        show_error_msg(JSON.parse(jqXHR.responseText).emsg)
                    },
                })
            },
        },

        atm_strike_details : {},
        atm_strikes : {},

        find_atm_strike_price : function(instrument) {
            let mod = Math.round(this.get_ltp(instrument)%100);
            let strike_price;
            if(mod < 50)
                strike_price = Math.floor(this.get_ltp(instrument)/100) * 100;
            else
                strike_price = Math.ceil(this.get_ltp(instrument)/100) * 100;
            return strike_price
        },

        get_ltp: function(instrument) {
            switch(instrument) {
                case 'nifty': return live_data[nifty_tk]; break;
                case 'bank_nifty': return live_data[bank_nifty_tk]; break;
                case 'fin_nifty': return live_data[fin_nifty_tk]; break;
                default : return NaN; break;
            }
        },

        find_atm_strikes : function() {
            let instruments = ['nifty', 'bank_nifty', 'fin_nifty']
            instruments.forEach(function(instr) {
                let strike = shoonya.find_atm_strike_price(instr);
                let str = instr + "_" + strike
                if(shoonya.atm_strikes[instr] !== str) {
                    //New strike found
                    console.log("New strike price found for " + instr + " " + strike)
                    shoonya.search.search_strike(instr, strike)
                    shoonya.atm_strikes[instr] = str;
                }
            })
            setTimeout(shoonya.find_atm_strikes, 60000); //Keep looping to find ATM strike price
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
        setTimeout(broker.find_atm_strikes, 2000)
    }

    return {
        "subscribed_symbols": subscribed_symbols,
        "live_data": live_data,
        "show_success_msg" : show_success_msg,
        "show_error_msg" : show_error_msg,
        "connect_to_server" : connect_to_server,
        "select_broker" : select_broker,
        "atm_strike_details": shoonya.atm_strike_details,
    }

}();


