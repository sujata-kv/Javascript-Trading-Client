client_api = window.client_api || {};

client_api = function () {
    const conf = {
        user_id : "FA90807",
        session_token: "60c9731d931f0156710a4c5828b362a120a54dfa972acfa4c796bc5e23e0a8e7",

        instrument : "nifty",  // nifty, bank_nifty, fin_nifty
        atm_strike_check_interval : 60000,
        strikes_after_before_atm : 3,

        bank_nifty: {
            round_to: 100,
        },
        nifty : {
            round_to: 50,
        },
        fin_nifty : {
            round_to: 50,
        },

        heartbeat_timeout : 7000,
        alert_msg_disappear_after : 3000, // Unit milliseconds
    }

    let nifty_tk, bank_nifty_tk, fin_nifty_tk = '';
    let ws = '';
    let subscribed_symbols = []
    let pending_to_subscribe_tokens = new Set();
    let logged_in = false;
    let live_data = {};
    let broker = '';

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
            nifty_tk = '26000', bank_nifty_tk = '26009', fin_nifty_tk = '26037';
            subscribed_symbols = ["NSE|26000", "NSE|26009", "NSE|26037"];
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
                        if(instr_token === nifty_tk || instr_token === bank_nifty_tk || instr_token === fin_nifty_tk) {
                            $('#spot').html(ltpf)
                        } else {
                            option_chain_tracker.update_table(instr_token, ltpf)
                        }
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
            payload = payload + "&jKey=" + conf.session_token;
            return payload
        },

        search : {
            search_subscribe_strike: function (instrument, strike, ce_pe) {
                let params = {
                    "uid": conf.user_id,
                    "stext": instrument.replace('_', '') + " " + strike + " " + ce_pe
                }
                $.ajax({
                    url: shoonya.url.search_instrument,
                    type: "POST",
                    dataType: "json",
                    data: shoonya.get_payload(params),
                    success: function (data, textStatus, jqXHR) {
                        // console.log("Ajax success")
                        let info = data.values[0];
                        option_chain_tracker.monitored_strikes.push({"token": info.token, "strike": strike, "optt": ce_pe});
                        option_chain_tracker.token_details[info.token] = {strike : strike, optt: ce_pe};
                        shoonya.subscribe_token('NFO|' + info.token);
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.log("Ajax error")
                        console.error(JSON.parse(jqXHR.responseText).emsg)
                    },
                })
            },
        }
    }

    const option_chain_tracker = {
        monitored_strikes: [],  //Contains details such as token, optt and strike for each monitored strike
        token_details : {},     //Contains the strike price and optt
        cell_mapping : {
            left_spr1 : 0,
            left_spr2 : 1,
            ce : 2,
            strike : 3,
            pe : 4,
            right_spr1 : 5,
            right_spr2 : 6,
        },

        cur_atm_strike : "",
        atm_changed : false,

        find_atm_strike_price: function (instrument) {
            let round_to = conf[instrument].round_to;
            let mod = Math.round(this.get_ltp(instrument) % round_to);
            let strike_price;
            if (mod < round_to / 2)
                strike_price = Math.floor(this.get_ltp(instrument) / round_to) * round_to;
            else
                strike_price = Math.ceil(this.get_ltp(instrument) / round_to) * round_to;
            return strike_price
        },

        get_sorted_strike_prices : function(instrument, atm_strike) {
            console.log("Sorting the strike prices..")
            let selected_strikes = [atm_strike]
            let cnt = 1; //ATM + 3 above + 3 below
            while (cnt <= conf.strikes_after_before_atm) {
                let strike = atm_strike + cnt * conf[instrument].round_to
                selected_strikes.push(strike)
                strike = atm_strike - cnt * conf[instrument].round_to
                selected_strikes.push(strike)
                cnt = cnt + 1;
            }
            selected_strikes.sort((a, b) => a - b);
            return selected_strikes;
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

        find_atm_strikes: function (instr) {
            if(logged_in) {
                let atm_strike = option_chain_tracker.find_atm_strike_price(instr);
                if(atm_strike != this.cur_atm_strike) {
                    this.atm_changed = true
                    this.cur_atm_strike = atm_strike

                    this.monitored_strikes = []
                    console.log(instr + ": ATM strike : " + atm_strike)
                    let all_strikes = this.get_sorted_strike_prices(instr, atm_strike)
                    all_strikes.forEach(function(strike) {
                        option_chain_tracker.subscribe_strike(instr, strike)
                    })
                } else {
                    this.atm_changed = false
                }
            }
            setTimeout(function() {option_chain_tracker.find_atm_strikes(conf.instrument)}, conf.atm_strike_check_interval); //Keep looping to find ATM strike price
        },

        subscribe_strike : function(instr, strike) {
            console.log(instr + ": " + strike)
            broker.search.search_subscribe_strike(instr, strike, "CE")
            broker.search.search_subscribe_strike(instr, strike, "PE")
        },

        update_table : function(token, lp) {
            console.log("Update table called for " + token + " LP = " + lp)
            const priceTableBody = document.querySelector('#option_chain_body');
            let data = this.get_token_details(token)

            if(data != null) {
                const rowId = `row_${data.strike}`;
                let row = priceTableBody.querySelector(`#${rowId}`);
                if (!row) {
                    // If the row doesn't exist, create a new one
                    row = priceTableBody.insertRow();
                    row.id = rowId;

                    if (data.strike === this.cur_atm_strike) {
                        $(row).addClass('table-active');
                    }

                    // Create cells for each column
                    const cellCnt = Object.keys(this.cell_mapping).length;
                    for (let i = 0; i < cellCnt; i++) {
                        row.insertCell(i);
                    }

                    if(data.optt === 'CE')
                        row.cells[this.cell_mapping.ce].textContent = lp;
                    else if(data.optt == 'PE')
                        row.cells[this.cell_mapping.pe].textContent = lp;

                    row.cells[this.cell_mapping.strike].textContent = data.strike;
                } else {
                    if (data.optt === 'CE') {
                        row.cells[this.cell_mapping.ce].textContent = lp;
                    } else if (data.optt === 'PE') {
                        row.cells[this.cell_mapping.pe].textContent = lp;
                    }
                }
            }

        },

        get_token_details : function(token) {
            // Check if the token exists in the mapping variable
            if (this.token_details.hasOwnProperty(token)) {
                return this.token_details[token];
            } else {
                return null;
            }
        },

    }

    function connect_to_server(){
        broker.init();
        broker.connect();
        conf.instrument_token = conf.instrument === "nifty"? nifty_tk
                                    : conf.instrument === "bank_nifty"? bank_nifty_tk
                                    : conf.instrument === "fin_nifty" ? fin_nifty_tk : "unknown_instrument";
        $('#instrument').html(conf.instrument.toUpperCase())
        setTimeout(function() {option_chain_tracker.find_atm_strikes(conf.instrument)}, 1000)
    }

    /*Attach functions to connect, add to watch list button, etc*/
    $(document).ready(function() {
        broker = shoonya
        connect_to_server();
    });

    return {
        "connect_to_server" : connect_to_server,
        "live_data" : live_data,
        "oc_tracker" : option_chain_tracker,
    }
}();


