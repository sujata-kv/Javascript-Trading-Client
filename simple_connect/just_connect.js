client_api = window.client_api || {};

client_api = function () {
    let conf = {
        user_id : "FA90807",
        session_token: "a95f3233d85bbb9dada54673ac033499893b1980475c1ffb87f75244b873cf52",
        heartbeat_timeout : 7000,
        alert_msg_disappear_after : 3000, // Unit milliseconds
    }

    let vix_tk, nifty_tk, bank_nifty_tk, fin_nifty_tk = '';
    let user_id = '', session_token='', ws = '';
    let subscribed_symbols = []
    let pending_to_subscribe_tokens = new Set();
    let logged_in = false;
    let live_data = {};
    let broker = '';

    function select_broker(broker_name) {

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
                    "uid": conf.user_id,
                    "actid": conf.user_id,
                    "susertoken": conf.session_token,
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
                        live_data[instr_token] = ltpf
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
    }

    function connect_to_server(){
        broker.init();
        broker.connect();
        // broker.search.attach_search_autocomplete();
    }

    /*Attach functions to connect, add to watch list button, etc*/
    $(document).ready(function() {
        select_broker("shoonya");
        connect_to_server();
    });

    return {
        "connect_to_server" : connect_to_server,
    }
}();


