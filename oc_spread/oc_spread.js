client_api = window.client_api || {};

client_api = function () {
    const conf = {
        user_id : "FA90807",
        session_token: "8171c2d57257725ebd336761d8b70c762eddc0c6beb1e09ddc42a208f9f81c32",

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

    const is_paper_trade = function() {
        return !$('#trade_type').hasClass('active');
    };

    const toggle_paper_trade = function() {
        $('#trade_type').toggleClass('active');
        if(is_paper_trade()) {
            $('#trade_type').text("Paper Trade")
            document.body.className = 'paper_trade';
        } else {
            $('#trade_type').text("Real Trade")
            document.body.className = 'real_trade';
        }
    };

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
            place_order: "https://trade.shoonya.com/NorenWClientWeb/PlaceOrder",
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

        unsubscribe_token: function(token) {
            console.log("unsubscribe_token yet to be implemented")
        },

        get_payload: function (params) {
            let payload = 'jData=' + JSON.stringify(params);
            payload = payload + "&jKey=" + conf.session_token;
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
                        // console.log("Ajax success")
                        let info = data.values[0];
                        option_chain_tracker.monitored_strikes.push({"token": parseInt(info.token), "strike": strike, "optt": ce_pe});
                        option_chain_tracker.token_details[info.token] = {strike : strike, optt: ce_pe, "tsym": info.tsym, "dname": info.dname, "ls": info.ls};
                        if(strike == option_chain_tracker.cur_atm_strike) {
                            if(ce_pe == "CE")
                                option_chain_tracker.atm_ce_token = info.token
                            else
                                option_chain_tracker.atm_pe_token = info.token
                        }
                        shoonya.subscribe_token('NFO|' + info.token);
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.log("Ajax error")
                        console.error(JSON.parse(jqXHR.responseText).emsg)
                    },
                })
            },
        },

        order : {
            get_order_params: function (token, buy_or_sell, qty, prd = '') {

                let prctyp = 'LMT', price = "0.0";
                let remarks = "";
                prctyp = 'MKT'
                let exch = "NFO";
                /* "C" For CNC, "M" FOR NRML, "I" FOR MIS, "B" FOR BRACKET ORDER, "H" FOR COVER ORDER*/
                if (exch == "NSE" || exch == "BSE") {
                    prd = prd == "" ? "I" : prd;
                } else {
                    prd = prd == "" ? "M" : prd;
                }

                let token_details = option_chain_tracker.get_token_details(token)

                let values = {'ordersource': 'WEB'};
                values["uid"] = conf.user_id;
                values["actid"] = conf.user_id;
                values["trantype"] = buy_or_sell;
                values["prd"] = prd;
                values["exch"] = exch;
                values["tsym"] = encodeURIComponent(token_details.tsym);
                values["dname"] = encodeURIComponent(token_details.dname);
                values["token"] = token;
                values["qty"] = token_details.ls;
                values["dscqty"] = token_details.ls;
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
        }
    }

    const orderbook = {
        buy : function(buy_btn) {
            if(!is_paper_trade()) {
                let cell_elm = $(buy_btn).parent().parent();
                console.log("buy called.. for " + cell_elm)
                cell_elm.find('.buy').attr('disabled', 'disabled');
                let token = cell_elm.attr('token')
                orderbook.place_buy_sell_order(token, 'B')
            } else {
                alert("You are in paper trade mode")
            }
        },

        sell : function(sell_btn) {
            if(!is_paper_trade()) {
                let cell_elm = $(sell_btn).parent().parent();
                console.log("sell called.. for " + cell_elm)
                cell_elm.find('.sell').attr('disabled', 'disabled');
                let token = cell_elm.attr('token')
                orderbook.place_buy_sell_order(token, 'S')
            } else {
                alert("You are in paper trade mode")
            }
        },

        deploy: function(btn){
            if(!is_paper_trade()) {
                let cell_elm = $(btn).parent().parent();
                console.log("deploy called.. for " + cell_elm)
                cell_elm.find('.deploy').attr('disabled', 'disabled');
                let token = cell_elm.attr('buy_token')
                orderbook.place_buy_sell_order(token, 'B')
                token = cell_elm.attr('sell_token')
                orderbook.place_buy_sell_order(token, 'S')
            } else {
                alert("You are in paper trade mode")
            }
        },

        place_buy_sell_order: function(cell_elm, buy_sell) {
            let params = broker.order.get_order_params(cell_elm, buy_sell, 15)
            broker.order.place_order(params, function (data) {
                if (success_cb != undefined) {  // Call custom function provided.. In case of exit, it needs to remove tr
                    console.log("Success call back is provided. Will be called")
                    success_cb(data)
                } else { // No custom function provided. Default actions
                    console.log("Default place order call back called")
                    orderbook.place_order_cb_carry_target_sl_to_active_trade(data)
                }
            })
        }
    }

    const option_chain_tracker = {
        monitored_strikes: [],  //Contains details such as token, optt and strike for each monitored strike
        token_details : {},     //Contains the strike price and optt
        spreads : {}, //Contains strike and the related row_spreads

        cur_atm_strike : "",
        atm_ce_token :"",
        atm_pe_token :"",

        cell_mapping : {        /*If any of these mappings change, then make sure to update the switch case where we create buttons */
            left_put_spr2 : 0,
            left_put_spr1 : 1,
            left_spr2 : 2,
            left_spr1 : 3,
            ce : 4,
            strike : 5,
            pe : 6,
            right_spr1 : 7,
            right_spr2 : 8,
            right_call_spr1 : 9,
            right_call_spr2 : 10,
        },

        reset: function() {
            this.monitored_strikes.forEach(entry => {
                broker.unsubscribe_token(entry.token);

                let index = subscribed_symbols.indexOf(entry.token);
                if (index !== -1) {
                    // Use splice to remove the element at the found index
                    subscribed_symbols.splice(index, 1);
                }
            })
            this.monitored_strikes = []
            this.token_details = {}
            this.spreads = {}
            this.cur_atm_strike = ''
        },

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
                    this.reset();
                    this.cur_atm_strike = atm_strike
                    $('#option_chain_body').empty();
                    console.log("ATM strike : " + atm_strike)
                    let all_strikes = this.get_sorted_strike_prices(atm_strike)
                    all_strikes.forEach(function(strike) {
                        option_chain_tracker.subscribe_strike(strike)
                        option_chain_tracker.create_row(strike)
                    });

                    setTimeout(function waiting() {
                        if (all_strikes.length * 2 == option_chain_tracker.monitored_strikes.length){  //Token details contains two entries per strike, one for CE, one for PE
                            console.log("All the subscriptions are done. Calling make_spreads")
                            all_strikes.forEach(strike => option_chain_tracker.make_spreads(strike));
                        } else {
                            console.log("all_strikes len = " + (all_strikes.length*2) + " ... monitored_strikes len= " + option_chain_tracker.monitored_strikes.length)
                            console.log("All the subscriptions not done yet. Waiting..")
                            setTimeout(waiting, 100)
                        }
                    }, 100); //Wait until all the subscriptions are done

                    //Attach create button function on hover
                    $('#option_chain_body td').hover(
                        // Create buttons dynamically on hover
                        function() {
                            let cell = $(this)
                            let cellIndex = cell.index()

                            switch(cellIndex) {
                                case 4:
                                case 6:
                                    btnContainer = $('<div class="btn-container"></div>');
                                    let btnB = $('<button class="btn buy">B</button>').click(function() {orderbook.buy(this)});
                                    let btnS = $('<button class="btn sell">S</button>').click(function() {orderbook.sell(this)});

                                    // Append buttons to the container
                                    btnContainer.append(btnB, btnS);

                                    // Append the button container to the cell
                                    cell.append(btnContainer);

                                    // Show buttons on hover
                                    btnContainer.css('display', 'inline');
                                    // cell.css('width', '140px')
                                    break;

                                default:
                                    let cellContent = cell.find('span').text()
                                    if(cellContent !== "") {
                                        btnContainer = $('<div class="btn-container"></div>');
                                        let btnD = $('<button class="btn deploy">Deploy</button>').click(function () {
                                            orderbook.deploy(this)
                                        });

                                        // Append buttons to the container
                                        btnContainer.append(btnD);

                                        // Append the button container to the cell
                                        cell.append(btnContainer);

                                        // Show buttons on hover
                                        btnContainer.css('display', 'inline');
                                        // cell.css('width', '150px')
                                    }
                                    break;
                            }
                        },
                        function() {
                            // Hide and remove buttons on mouseout
                            $(this).find('.btn-container').remove();
                            // $(this).css('width', 'auto')
                        }
                    );
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
                    let cell = row.insertCell(i);
                    $(cell).append('<span></span>')
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

                /*If the strike is the ATM, then update ATM CE PE combined premium*/
                if(data.strike == option_chain_tracker.cur_atm_strike) {
                    let combined_prem = parseFloat(live_data[option_chain_tracker.atm_ce_token]) + parseFloat(live_data[option_chain_tracker.atm_pe_token]);
                    row.cells[this.cell_mapping.strike].textContent = data.strike + " [" + combined_prem.toFixed(1) +"] ";
                } else
                    $(row.cells[this.cell_mapping.strike]).text(data.strike);

                /*Update PE and CE*/
                if (data.optt === 'CE') {
                    $(row.cells[this.cell_mapping.ce]).find('span').text(lp);
                } else if (data.optt === 'PE') {
                    $(row.cells[this.cell_mapping.pe]).find('span').text(lp);
                }


                this.update_spreads(data.strike, data.optt);
            }
        },

        make_spreads: function(strike) {

            let spreads_template = {                //Contains spreads for a row, for a strike price
                left_put_spr2 : {buy:"", sell:""},
                left_put_spr1 : {buy:"", sell:""},
                left_spr1 : {buy:"", sell:""},
                left_spr2 : {buy:"", sell:""},
                right_spr1 : {buy:"", sell:""},
                right_spr2 : {buy:"", sell:""},
                right_call_spr1 : {buy:"", sell:""},
                right_call_spr2 : {buy:"", sell:""},
            };

            console.log("Making spreads for strike : " + strike)
            const row_spread = { ...spreads_template };

            //Bull call spreads
            let buy_leg_token = this.get_token_for_strike(strike, "CE");
            row_spread.left_spr1.buy = buy_leg_token;
            row_spread.left_spr1.sell = this.get_token_for_strike(strike + conf[conf.instrument].round_to, "CE");
            row_spread.left_spr2.buy = buy_leg_token;
            row_spread.left_spr2.sell = this.get_token_for_strike(strike + 2 * conf[conf.instrument].round_to, "CE");

            //Bull put spreads
            let sell_leg_token = this.get_token_for_strike(strike, "PE");
            row_spread.left_put_spr1.sell = sell_leg_token;
            row_spread.left_put_spr1.buy = this.get_token_for_strike(strike - conf[conf.instrument].round_to, "PE");
            row_spread.left_put_spr2.sell = sell_leg_token;
            row_spread.left_put_spr2.buy = this.get_token_for_strike(strike - 2 * conf[conf.instrument].round_to, "PE");

            //Attach token attributes to CE and PE cells
            let row = $(`#row_${strike}`)[0]
            row.cells[this.cell_mapping.ce].setAttribute('token', buy_leg_token)
            row.cells[this.cell_mapping.left_spr1].setAttribute('buy_token', row_spread.left_spr1.buy)
            row.cells[this.cell_mapping.left_spr1].setAttribute('sell_token', row_spread.left_spr1.sell)
            row.cells[this.cell_mapping.left_spr2].setAttribute('buy_token', row_spread.left_spr2.buy)
            row.cells[this.cell_mapping.left_spr2].setAttribute('sell_token', row_spread.left_spr2.sell)
            row.cells[this.cell_mapping.left_put_spr1].setAttribute('buy_token', row_spread.left_put_spr1.buy)
            row.cells[this.cell_mapping.left_put_spr1].setAttribute('sell_token', row_spread.left_put_spr1.sell)
            row.cells[this.cell_mapping.left_put_spr2].setAttribute('buy_token', row_spread.left_put_spr2.buy)
            row.cells[this.cell_mapping.left_put_spr2].setAttribute('sell_token', row_spread.left_put_spr2.sell)

            //Bear put spreads
            buy_leg_token = this.get_token_for_strike(strike, "PE");
            row_spread.right_spr1.buy = buy_leg_token;
            row_spread.right_spr1.sell = this.get_token_for_strike(strike - conf[conf.instrument].round_to, "PE" );
            row_spread.right_spr2.buy = buy_leg_token;
            row_spread.right_spr2.sell = this.get_token_for_strike(strike - 2 * conf[conf.instrument].round_to, "PE" );

            //Bear call spreads
            sell_leg_token = this.get_token_for_strike(strike, "CE");
            row_spread.right_call_spr1.sell = sell_leg_token;
            row_spread.right_call_spr1.buy = this.get_token_for_strike(strike + conf[conf.instrument].round_to, "CE" );
            row_spread.right_call_spr2.sell = sell_leg_token;
            row_spread.right_call_spr2.buy = this.get_token_for_strike(strike + 2 * conf[conf.instrument].round_to, "CE" );

            //Attach token attributes to CE and PE cells
            row.cells[this.cell_mapping.pe].setAttribute('token', buy_leg_token)
            row.cells[this.cell_mapping.right_spr1].setAttribute('buy_token', row_spread.right_spr1.buy)
            row.cells[this.cell_mapping.right_spr1].setAttribute('sell_token', row_spread.right_spr1.sell)
            row.cells[this.cell_mapping.right_spr2].setAttribute('buy_token', row_spread.right_spr2.buy)
            row.cells[this.cell_mapping.right_spr2].setAttribute('sell_token', row_spread.right_spr2.sell)
            row.cells[this.cell_mapping.right_call_spr1].setAttribute('buy_token', row_spread.right_call_spr1.buy)
            row.cells[this.cell_mapping.right_call_spr1].setAttribute('sell_token', row_spread.right_call_spr1.sell)
            row.cells[this.cell_mapping.right_call_spr2].setAttribute('buy_token', row_spread.right_call_spr2.buy)
            row.cells[this.cell_mapping.right_call_spr2].setAttribute('sell_token', row_spread.right_call_spr2.sell)

            this.spreads[strike] = row_spread;

            this.update_spreads(strike, "CE")       //Update spreads for the first time
            this.update_spreads(strike, "PE")       //Update spreads for the first time
            $('#spot').html(live_data[conf.instrument_token])
            this.update_totals();   //Update CE and PE totals
        },

        update_spreads: function(strike, optt) {
            let row_spread = this.spreads[strike]

            if(row_spread != undefined) {
                let row_id = this.get_row_id(strike)
                let row = document.getElementById(row_id)

                if (optt === "CE") {
                    $(row.cells[this.cell_mapping.left_spr1]).find('span').text( get_max_loss(row_spread.left_spr1.buy, row_spread.left_spr1.sell) );
                    $(row.cells[this.cell_mapping.left_spr2]).find('span').text( get_max_loss(row_spread.left_spr2.buy, row_spread.left_spr2.sell) );
                    $(row.cells[this.cell_mapping.left_put_spr1]).find('span').text( get_max_loss(row_spread.left_put_spr1.buy, row_spread.left_put_spr1.sell) );
                    $(row.cells[this.cell_mapping.left_put_spr2]).find('span').text( get_max_loss(row_spread.left_put_spr2.buy, row_spread.left_put_spr2.sell) );
                } else if (optt === "PE") {
                    $(row.cells[this.cell_mapping.right_spr1]).find('span').text( get_max_loss(row_spread.right_spr1.buy, row_spread.right_spr1.sell) );
                    $(row.cells[this.cell_mapping.right_spr2]).find('span').text( get_max_loss(row_spread.right_spr2.buy, row_spread.right_spr2.sell) );
                    $(row.cells[this.cell_mapping.right_call_spr1]).find('span').text( get_max_loss(row_spread.right_call_spr1.buy, row_spread.right_call_spr1.sell) );
                    $(row.cells[this.cell_mapping.right_call_spr2]).find('span').text( get_max_loss(row_spread.right_call_spr2.buy, row_spread.right_call_spr2.sell) );
                }

                //Update synthetic future value
                if(strike == option_chain_tracker.cur_atm_strike) {
                    let ce = parseFloat(row.cells[this.cell_mapping.ce].textContent)
                    let pe = parseFloat(row.cells[this.cell_mapping.pe].textContent);
                    let syn_fut = option_chain_tracker.cur_atm_strike + (ce-pe)
                    $('#syn_fut').html(syn_fut)
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

        update_totals : function() {
            /* Update ATM PE and CE combined premium*/

            /* Update CE and PE column totals */
            let ce_total = 0, pe_total = 0;
            for(let i=0; i<this.monitored_strikes.length; ++i) {
                let ms = this.monitored_strikes[i];
                if(ms.optt == "CE") {
                    ce_total += parseFloat(live_data[ms.token])
                } else if(ms.optt == "PE") {
                    pe_total += parseFloat(live_data[ms.token])
                }
            }
            $('#ce_total').html(ce_total.toFixed(1))
            $('#pe_total').html(pe_total.toFixed(1))

            setTimeout(function() {
                console.log("Updatetotals called");
                option_chain_tracker.update_totals();
            }, 1000)
        },
    }

    function connect_to_server(){
        broker.init();
        broker.connect();
        select_instrument()
    }

    function select_instrument() {
        option_chain_tracker.reset()

        conf.instrument = $('#select_instrument').val().toLowerCase();
        console.log("Select instrument " + conf.instrument)
        conf.instrument_token = conf.instrument === "nifty"? nifty_tk
            : conf.instrument === "bank_nifty"? bank_nifty_tk
                : conf.instrument === "fin_nifty" ? fin_nifty_tk : "unknown_instrument";
        $('#instrument').html(conf.instrument.toUpperCase().replace("_", " "))
        setTimeout(function() {option_chain_tracker.find_atm_strikes()}, 1000)
    }

    /*Attach functions to connect, add to watch list button, etc*/
    $(document).ready(function() {
        broker = shoonya        //TODO - As of now hardcoded to Shoonya. To be changed later
        connect_to_server();
    });

    return {
        "connect_to_server" : connect_to_server,
        "live_data" : live_data,
        "oc_tracker" : option_chain_tracker,
        "select_instrument" : select_instrument,
        "toggle_paper_trade" : toggle_paper_trade,
    }
}();


