
shoonya_api = window.shoonya_api || {};

shoonya_api = function () {

    let vix_tk = '26017', nifty_tk = '26000', bank_nifty_tk = '26009'
    let def_tokens = ["NSE|26017", "NSE|26000", "NSE|26009"]
    let user = '', session_token='', ws = ''

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
                        console.log('Default')
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

    $(document).ready(function() {
        $('#connect_to_server').click(function () {
            user = $('#userId').val()
            session_token = $('#sessionToken').val()
            connect()
        });
    });

    function subscribe_tokens(tokens) {
        let symtokens = {"t":"t","k": tokens.join('#').concat('#')}
        console.log(symtokens)
        ws.send(JSON.stringify(symtokens));
    }

    function get_search_payload(stext) {
        params = {"uid": user, "stext": stext}
        let payload = 'jData=' + JSON.stringify(params);
        payload = payload + "&jKey=" + session_token;
        return payload
    }

    search_instrument = function(stext) {
        let payload = get_search_payload(stext)
        $(document).ready(function () {
            $.ajax({
                url: "https://shoonya.finvasia.com/NorenWClientWeb/SearchScrip",
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
        });
    }

    $( "input.search-instrument" ).autocomplete({
            source:  function(request, response){ $.ajax({
                url: "https://shoonya.finvasia.com/NorenWClientWeb/SearchScrip",
                type: "POST",
                dataType: "json",
                data: get_search_payload(request.term),
                success: function (data, textStatus, jqXHR) {
                    console.log("Ajax success")
                    response($.map(data.values, function (item) {
                        console.log(item.dname + ", " + item.tsym)
                        return {
                            label: item.dname,
                            value: item.tsym
                        };
                    }));
                },
                select: function (event, ui) {
                    // when item is selected
                    $(this).val(ui.item.label);
                },
                // create: function () {
                //     $(this).data('ui-autocomplete')._renderItem = function (ul, item) {
                //         var path = 'basepath' + item.value;
                //
                //         return $('<li class="divSelection">')
                //             .append('<div>')
                //             .append('<img class="zoom" src="' + path + '" />')
                //             .append('<span>')
                //             .append(item.label)
                //             .append('</span>')
                //             .append('</div>')
                //             .append('</li>')
                //             .appendTo(ul); // customize your HTML
                //     };
                // },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Ajax error")
                },
                })},
            minLength: 3
    }).data('ui-autocomplete')._renderItem = function (ul, item) {

            return $('<li class="divSelection">')
                .append('<div>')
                .append('<span>')
                .append(item.label)
                .append('</span>')
                .append('</div>')
                .append('</li>')
                .appendTo(ul); // customize your HTML
    };


    return {
        "search_instrument" :  search_instrument,
        "connect" : connect
    }

}();


$(document).ready(function(){

})
