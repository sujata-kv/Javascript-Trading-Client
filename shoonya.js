
shoonya_api = window.shoonya_api || {};

shoonya_api = function () {

    let vix_tk = '26017', nifty_tk = '26000', bank_nifty_tk = '26009'
    let def_tokens = ["NSE|26017", "NSE|26000", "NSE|26009"]
    let user_id = '', session_token='', ws = '';
    let row_index = 0;

    const url = {
        websocket : "wss://shoonya.finvasia.com/NorenWSWeb/",
        search_instrument : "https://shoonya.finvasia.com/NorenWClientWeb/SearchScrip",
        order_book : "https://shoonya.finvasia.com/NorenWClientWeb/OrderBook",
        place_order : "https://shoonya.finvasia.com/NorenWClientWeb/PlaceOrder",
        modify_order : "https://shoonya.finvasia.com/NorenWClientWeb/ModifyOrder",
        cancel_order : "https://shoonya.finvasia.com/NorenWClientWeb/CancelOrder",
        exit_order : "https://shoonya.finvasia.com/NorenWClientWeb/ExitOrder",
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
            res = JSON.parse(event.data)
            // console.log(res)
            if ('s' in res) {
                if (res.s == 'OK') {
                    console.log('Login successful')
                    subscribe_tokens(def_tokens)
                }
            } else if ('lp' in res) {
                // console.log(res.tk + " " + res.lp)
                switch (res.tk) {
                    case vix_tk:
                        $('#vix').html(res.lp)
                        break;
                    case nifty_tk:
                        $('#nifty').html(res.lp)
                        break;
                    case bank_nifty_tk:
                        $('#bank_nifty').html(res.lp)
                        break;
                    default:
                        let elm = document.getElementById(res.tk)
                        $(elm).html(res.lp)
                        elm = document.getElementById("open_order_" + res.tk)  // In Active Trades table
                        $(elm).html(res.lp)
                        break;
                }
            }
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

    function subscribe_tokens(tokens) {
        let symtokens = {"t":"t","k": tokens.join('#').concat('#')}
        console.log(symtokens)
        if (ws.readyState != WebSocket.OPEN) {
            console.log("Web socket not ready yet..")
            setTimeout(function(){subscribe_tokens(tokens)}, 1)
        } else {
            console.log("Web socket is ready.. Subscribing ", tokens)
            ws.send(JSON.stringify(symtokens));
        }
    }

    function get_payload(params) {
        let payload = 'jData=' + JSON.stringify(params);
        payload = payload + "&jKey=" + session_token;
        return payload
    }

    function post_request(url, params, success_cb) {
        let payload = get_payload(params)
        $.ajax({
            url: url,
            type: "POST",
            dataType: "json",
            data: payload,
            success: function (data, textStatus, jqXHR) {
                console.log("Ajax success")
                if (success_cb != undefined) {
                    success_cb(data)
                }
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log("Ajax error")
            }
        });
    }

    search_instrument = function(stext) {
        params = {"uid": user_id, "stext": stext}
        post_request(search, params);
    }

    /* Search instrument autocomplete */
    $( "input.search-instrument" ).autocomplete({
            minLength: 3,
            autoFocus: true,
            // appendTo: '#instr-drop-down',
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
                                        label: item.dname,
                                        value: item.dname,
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

        get_orderbook : function() {
            let values          = {};
            values["uid"]       = user_id ;
            let payload = get_payload(values)
            $.ajax({
                url: url.order_book,
                type: "POST",
                dataType: "json",
                data: payload,
                success: function (data, textStatus, jqXHR) {
                    $('#open_order_list').html('')
                    data.forEach(orderbook.add_open_order)
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Ajax error")
                }
            });
        },

        add_open_order : function(item) {
            if (item.status == "OPEN") {
                console.log(item.norenordno)
                let badge = '';
                if (item.trantype == "B") {
                    badge = '<span class="badge badge-success">Buy</span>'
                } else {
                    badge = '<span class="badge badge-danger">Sell</span>'
                }
                let open = item.amo == "Yes"? "AMO Open": "Open";

                let dname = (item.dname != undefined)? item.dname : item.tsym;
                $('#open_order_list').append(`<tr exch="${item.exch}" tsym="${item.tsym}" qty="${item.qty}" token="${item.token}">
                        <td scope="row"><span class="badge badge-info">${open}</span></td>
                        <td class="order-num">${item.norenordno}</td>
                        <td>${dname}</td>
                        <td>${badge}</td>
                        <th id="open_order_${item.token}"></th>
                        <td><input type="text" class="form-control" placeholder="" aria-label="strike"
                                                    aria-describedby="basic-addon1" value="${item.prc}"></td>
                        <td><input type="text" class="form-control" placeholder="" aria-label="strike"
                                                   aria-describedby="basic-addon1" value="${item.qty}"></td>
    
                        <td><button type="button" class="btn btn-success" onclick="shoonya_api.orderbook.modify_order(this)">Modify</button></td>
                        <td><button type="button" class="btn btn-danger" onclick="shoonya_api.orderbook.cancel_order(this)">Cancel</button></td>
                </tr>`);

                let token = item.exch + "|" + item.token
                subscribe_tokens([token])
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
                let reply = post_request(url.place_order, params)
                console.log("Buy reply = ", reply)
                return reply;
            }
        },

        sell : function(elm) {

        },

        get_order_params: function(elm, buy_or_sell, entry, qty) {

            let prctyp = 'LMT', price = "0.0";
            if(entry.value == '') {
                prctyp = 'MKT'
            } else price = entry.value.toString()

            let values          =  {'ordersource':'WEB'};
            values["uid"]       = user_id;
            values["actid"]     = user_id;
            values["trantype"]  = buy_or_sell;
            values["prd"]       = 'M' ;                 /* "C" For CNC, "M" FOR NRML, "I" FOR MIS, "B" FOR BRACKET ORDER, "H" FOR COVER ORDER*/
            values["exch"]      = elm.attr('exch');
            values["tsym"]      = elm.attr('tsym');
            values["qty"]       = qty;
            values["dscqty"]    = qty;
            values["prctyp"]    = prctyp       /*  LMT / MKT / SL-LMT / SL-MKT / DS / 2L / 3L */
            values["prc"]       = price;
            values["ret"]       = 'DAY';

            return values;
        },

        cancel_order : function(td_elm) {
            relm = $(td_elm).parent().parent();
            orderno = relm.find('.order-num').html()

            let values            = {'ordersource':'WEB'};
            values["uid"]         = user_id;
            values["norenordno"]  = orderno;

            let reply = post_request(url.cancel_order, values);
            console.log('Cancel order reply = ', reply)
            return reply;
        },
    };

    /*Attach functions to connect, add to watch list button, etc*/
    $(document).ready(function() {
        $('#connect_to_server').click(function () {
            user_id = $('#userId').val()
            session_token = $('#sessionToken').val()
            connect()
            orderbook.get_orderbook()
        });

        $('#add_to_watchlist').click(function() {
            sym = $('input.watch_item').val()
            lot_size = $('input.watch_item').attr('lot_size')
            exch = $('input.watch_item').attr('exch')
            token = $('input.watch_item').attr('token')
            tsym = $('input.watch_item').attr('tsym')
            optt = $('input.watch_item').attr('optt')
            put_option = false
            if (optt == "PE") {
                put_option = true
            }
            add_row_to_watch(sym, lot_size, exch, token, tsym, put_option)
        })
    });


    function add_row_to_watch(sym, lot_size, exch, token, tsym, put_option) {
        subscribe_tokens( [exch + '|' + token])
        class_name = ''
        if(put_option) {
            class_name = 'table-danger'
        }

        $('#watch_list_tbody').append(`<tr id="R${++row_index}" class="${class_name}" exch="${exch}" tsym="${tsym}" lot_size="${lot_size}">

            <th scope="row" ">${row_index}</th>
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

    function delete_row(elm) {
        $(elm).parent().remove();
    }

    return {
        "search_instrument" :  search_instrument,
        "connect" : connect,
        "delete_row": delete_row,
        "post_request": post_request,
        "get_orderbook": orderbook.get_orderbook,
        "orderbook": orderbook,
    }

}();



$(document).ready(function(){

})
