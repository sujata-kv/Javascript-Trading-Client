
shoonya_api = window.shoonya_api || {};

shoonya_api = function () {

    let vix_tk = '26017', nifty_tk = '26000', bank_nifty_tk = '26009'
    let def_tokens = ["NSE|26017", "NSE|26000", "NSE|26009"]
    let user = '', session_token='', ws = '';
    let row_index = 0;

    function connect() {
        ws = new WebSocket("wss://shoonya.finvasia.com/NorenWSWeb/");
        ws.onopen = function (event) {
            let data = {
                "t": "c",
                "uid": user,
                "actid": user,
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

    function get_search_payload(stext) {
        params = {"uid": user, "stext": stext}
        return get_payload(params)
    }

    function get_payload(params) {
        let payload = 'jData=' + JSON.stringify(params);
        payload = payload + "&jKey=" + session_token;
        return payload
    }

    function post_request(url, params) {
        let payload = get_payload(params)
        $.ajax({
            url: url,
            type: "POST",
            dataType: "json",
            data: payload,
            success: function (data, textStatus, jqXHR) {
                console.log("Ajax success")
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log("Ajax error")
            }
        });
    }

    search_instrument = function(stext) {
        params = {"uid": user, "stext": stext}
        post_request("https://shoonya.finvasia.com/NorenWClientWeb/SearchScrip", params);
    }

    /* Search instrument autocomplete */
    $( "input.search-instrument" ).autocomplete({
            minLength: 3,
            autoFocus: true,
            appendTo: '#instr-drop-down',
            source:  function(request, response){ $.ajax({
                        url: "https://shoonya.finvasia.com/NorenWClientWeb/SearchScrip",
                        type: "POST",
                        dataType: "json",
                        data: get_search_payload(request.term),
                        success: function (data, textStatus, jqXHR) {
                            console.log("Ajax success")
                            response($.map(data.values, function (item) {
                                return {
                                    label: item.dname,
                                    value: item.dname,
                                    tsymbol: item.tsym,
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
                $(this).attr('tsymbol', ui.item.tsymbol)
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
            values["uid"]       = user ;
            let payload = get_payload(values)
            $.ajax({
                url: 'https://shoonya.finvasia.com/NorenWClientWeb/OrderBook',
                type: "POST",
                dataType: "json",
                data: payload,
                success: function (data, textStatus, jqXHR) {
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

                $('#open_order_list').append(`<tr>
                        <td scope="row"><span class="badge badge-info">${open}</span></td>
                        <td>${item.norenordno}</td>
                        <td>${item.dname}</td>
                        <td>${badge}</td>
                        <th id="open_order_${item.token}"></th>
                        <td><input type="text" class="form-control" placeholder="" aria-label="strike"
                                                    aria-describedby="basic-addon1" value="${item.prc}"></td>
                        <td><input type="text" class="form-control" placeholder="" aria-label="strike"
                                                   aria-describedby="basic-addon1" value="${item.qty}"></td>
    
                        <td><button type="button" class="btn btn-success" onclick="orderbook.modify_order">Modify</button></td>
                        <td><button type="button" class="btn btn-danger" onclick="orderbook.cancel_order">Cancel</button></td>
                </tr>`);

                let token = item.exch + "|" + item.token
                subscribe_tokens([token])
            }
        }
    };

    /*Attach functions to connect, add to watch list button, etc*/
    $(document).ready(function() {
        $('#connect_to_server').click(function () {
            user = $('#userId').val()
            session_token = $('#sessionToken').val()
            connect()
            orderbook.get_orderbook()
        });

        $('#add_to_watchlist').click(function() {
            sym = $('input.watch_item').val()
            lot_size = $('input.watch_item').attr('lot_size')
            exch = $('input.watch_item').attr('exch')
            token = $('input.watch_item').attr('token')
            tsymbol = $('input.watch_item').attr('tsymbol')
            optt = $('input.watch_item').attr('optt')
            put_option = false
            if (optt == "PE") {
                put_option = true
            }
            add_row_to_watch(sym, lot_size, exch, token, put_option)
        })
    });


    function add_row_to_watch(sym, lot_size, exch, token, put_option) {
        subscribe_tokens( [exch + '|' + token])
        class_name = ''
        if(put_option) {
            class_name = 'table-danger'
        }

        $('#watch_list_tbody').append(`<tr id="R${++row_index}" class="${class_name}">

            <th scope="row" ">${row_index}</th>
            <td>${sym}</td>
            <th id="${token}"></th>
            <td><input type="text" class="form-control" placeholder="" aria-label="limit" aria-describedby="basic-addon1"></td>
            <td><input type="text" class="form-control" placeholder="" aria-label="qty" aria-describedby="basic-addon1" value="${lot_size}"></td>
            <td><button type="button" class="btn btn-success">BUY</button></td>
            <td><button type="button" class="btn btn-danger">SELL</button></td>
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
    }

}();



$(document).ready(function(){

})
