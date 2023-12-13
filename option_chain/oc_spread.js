client_api = window.client_api || {};

client_api = function () {
    const conf = {
        user_id : "FA90807",
        session_token: "842cab4a987c3cec514628f78b2082885d2a4ccbde6a6d2d114d2f0de32728eb",

        instrument : "bank_nifty",  // nifty, bank_nifty, fin_nifty
        atm_strike_check_interval : 30000,
        strikes_after_before_atm : 3,

        bank_nifty: {
            round_to: 100,
            lot_size : 15,
        },
        nifty : {
            round_to: 50,
            lot_size : 50,
        },
        fin_nifty : {
            round_to: 50,
            lot_size : 40,
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
                        if(instr_token === conf.instrument_token) {
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
            search_subscribe_strike: function (strike, ce_pe) {
                let params = {
                    "uid": conf.user_id,
                    "stext": conf.instrument.replace('_', '') + " " + strike + " " + ce_pe
                }
                $.ajax({
                    url: shoonya.url.search_instrument,
                    type: "POST",
                    dataType: "json",
                    data: shoonya.get_payload(params),
                    success: function (data, textStatus, jqXHR) {
                        console.log("Ajax success")
                        let info = data.values[0];
                        option_chain_tracker.monitored_strikes.push({"token": parseInt(info.token), "strike": strike, "optt": ce_pe});
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
            left_spr2 : 0,
            left_spr1 : 1,
            ce : 2,
            strike : 3,
            pe : 4,
            right_spr1 : 5,
            right_spr2 : 6,
        },

        spreads : {}, //Contains strike and the related row_spreads

        cur_atm_strike : "",
        atm_changed : false,

        find_atm_strike_price: function () {
            let round_to = conf[conf.instrument].round_to;
            let mod = Math.round(this.get_ltp(conf.instrument) % round_to);
            let strike_price;
            if (mod < round_to / 2)
                strike_price = Math.floor(this.get_ltp(conf.instrument) / round_to) * round_to;
            else
                strike_price = Math.ceil(this.get_ltp(conf.instrument) / round_to) * round_to;
            return strike_price
        },

        get_sorted_strike_prices : function(atm_strike) {
            console.log("Sorting the strike prices..")
            let selected_strikes = [atm_strike]
            let cnt = 1; //ATM + 3 above + 3 below
            while (cnt <= conf.strikes_after_before_atm) {
                let strike = atm_strike + cnt * conf[conf.instrument].round_to
                selected_strikes.push(strike)
                strike = atm_strike - cnt * conf[conf.instrument].round_to
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

        find_atm_strikes: function () {
            if(logged_in) {
                let atm_strike = option_chain_tracker.find_atm_strike_price();
                if(atm_strike != this.cur_atm_strike) {
                    this.atm_changed = true
                    this.cur_atm_strike = atm_strike

                    this.monitored_strikes = [];
                    $('#option_chain_body').empty();
                    console.log("ATM strike : " + atm_strike)
                    let all_strikes = this.get_sorted_strike_prices(atm_strike)
                    all_strikes.forEach(function(strike) {
                        option_chain_tracker.subscribe_strike(strike)
                        option_chain_tracker.create_row(strike)
                    });

                    setTimeout(function() {
                        all_strikes.forEach(strike => option_chain_tracker.make_spreads(strike));
                    }, 1000)
                } else {
                    this.atm_changed = false
                }
            }
            setTimeout(function() {option_chain_tracker.find_atm_strikes()}, conf.atm_strike_check_interval); //Keep looping to find ATM strike price
        },

        subscribe_strike : function(strike) {
            console.log("Strike : " + strike)
            broker.search.search_subscribe_strike(strike, "CE")
            broker.search.search_subscribe_strike(strike, "PE")
        },

        get_token_details : function(token) {
            // Check if the token exists in the mapping variable
            if (this.token_details.hasOwnProperty(token)) {
                return this.token_details[token];
            } else {
                return null;
            }
        },

        get_token_for_strike: function(strike, optt) {
            const result = this.monitored_strikes.find(entry => entry.strike === strike && entry.optt === optt);
            return result ? result.token : null;
        },

        get_row_id: function (strike) {
            return `row_${strike}`;
        },

        create_row : function(strike) {
            const rowId = this.get_row_id(strike);
            const priceTableBody = document.querySelector('#option_chain_body');
            let row = document.getElementById(`#${rowId}`);

            if (!row) {
                // If the row doesn't exist, create a new one
                row = priceTableBody.insertRow();
                row.id = rowId;

                if (strike === this.cur_atm_strike) {
                    $(row).addClass('table-active');
                }

                // Create cells for each column
                const cellCnt = Object.keys(this.cell_mapping).length;
                for (let i = 0; i < cellCnt; i++) {
                    row.insertCell(i);
                }
            }
        },

        update_table : function(token, lp) {
            // console.log("Update table called for " + token + " LP = " + lp)
            const priceTableBody = document.querySelector('#option_chain_body');
            let data = this.get_token_details(token)

            if(data != null) {
                const rowId = this.get_row_id(data.strike);
                let row = priceTableBody.querySelector(`#${rowId}`);

                row.cells[this.cell_mapping.strike].textContent = data.strike;
                if (data.optt === 'CE') {
                    row.cells[this.cell_mapping.ce].textContent = lp;
                } else if (data.optt === 'PE') {
                    row.cells[this.cell_mapping.pe].textContent = lp;
                }
                this.update_spreads(data.strike, data.optt);
            }
        },

        make_spreads : function(strike) {

            let spreads_template = {                //Contains spreads for a row, for a strike price
                left_spr1 : {buy:"", sell:""},
                left_spr2 : {buy:"", sell:""},
                right_spr1 : {buy:"", sell:""},
                right_spr2 : {buy:"", sell:""},
                btfly1 : {},
                btfly2 : {},
                btfly3 : {},
            };

            console.log("Making spreads for strike : " + strike)
            const row_spread = { ...spreads_template };

            //CE
            let buy_leg_token = this.get_token_for_strike(strike, "CE");
            // let sell_leg_token = this.get_token_for_strike(strike + conf[conf.instrument].round_to, "CE");

            row_spread.left_spr1.buy = buy_leg_token;
            row_spread.left_spr1.sell = this.get_token_for_strike(strike + conf[conf.instrument].round_to, "CE");

            row_spread.left_spr2.buy = buy_leg_token;
            row_spread.left_spr2.sell = this.get_token_for_strike(strike + 2 * conf[conf.instrument].round_to, "CE");

            //PE
            buy_leg_token = this.get_token_for_strike(strike, "PE");
            // sell_leg_token = this.get_token_for_strike(strike - conf[conf.instrument].round_to, "PE" );

            row_spread.right_spr1.buy = buy_leg_token;
            row_spread.right_spr1.sell = this.get_token_for_strike(strike - conf[conf.instrument].round_to, "PE" );

            row_spread.right_spr2.buy = buy_leg_token;
            row_spread.right_spr2.sell = this.get_token_for_strike(strike - 2 * conf[conf.instrument].round_to, "PE" );

            this.spreads[strike] = row_spread;
            console.log(row_spread)
        },

        update_spreads : function(strike, optt) {
            let row_spread = this.spreads[strike]

            if(row_spread != undefined) {
                let row_id = this.get_row_id(strike)
                let row = document.getElementById(row_id)

                if (optt === "CE") {
                    row.cells[this.cell_mapping.left_spr1].textContent = get_max_loss(row_spread.left_spr1.buy, row_spread.left_spr1.sell);
                    row.cells[this.cell_mapping.left_spr2].textContent = get_max_loss(row_spread.left_spr2.buy, row_spread.left_spr2.sell);
                } else if (optt === "PE") {
                    row.cells[this.cell_mapping.right_spr1].textContent = get_max_loss(row_spread.right_spr1.buy, row_spread.right_spr1.sell);
                    row.cells[this.cell_mapping.right_spr2].textContent = get_max_loss(row_spread.right_spr2.buy, row_spread.right_spr2.sell);
                }
            }

            function get_max_loss(buy_leg, sell_leg) {
                if( buy_leg != undefined && buy_leg !='' && sell_leg != undefined && sell_leg != '') {
                    let loss = live_data[buy_leg] - live_data[sell_leg]
                    loss = (loss * conf[conf.instrument].lot_size).toFixed(2)
                    return loss;
                } else {
                    return '';
                }
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
        setTimeout(function() {option_chain_tracker.find_atm_strikes()}, 1000)
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


