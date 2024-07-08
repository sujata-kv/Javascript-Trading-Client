conf = window.conf || {};
conf = {
    broker : {
        shoonya: {
            user_id: "FA90807",
            session_token: "",

/*            user_id: "FA85460",
            session_token: "f9915f6fc30ace39c24bc0d752eb0c0cac653ff705db582c421efb2203b86b26",*/
        },
        kite : {
            user_id : "VC1177",
            session_token : "",

            /*user_id : "FZ0468",
            session_token : "ml90XIHwiEqhjbfEDP0Vpce634HTmZw0mCistEgfN0vtts3Nur86vna2L28deDwczTICB5q32aJ6DfLRPDhYxKYDvahcf6k+x1nZXwxs8yaLq7l0LuwWFQ=="*/
        }
    },

    bank_nifty: {
        round_to: 100,
        lot_size : 15,
        max_order_qty: 900,
    },
    nifty : {
        round_to: 50,
        lot_size : 25,
        max_order_qty: 1800,
    },
    fin_nifty : {
        round_to: 50,
        lot_size : 40,
        max_order_qty: 1800,
    },
    midcap_nifty : {
        round_to: 25,
        lot_size : 75,
        max_order_qty: 4200,
    },
    sensex : {
        round_to: 100,
        lot_size : 10,
        max_order_qty: 500,
    },
    bankex : {
        round_to: 100,
        lot_size : 15,
        max_order_qty: 600,
    },

    spreads : {
        instrument : "bank_nifty",  // Default instrument..  nifty, bank_nifty, fin_nifty are the allowed values
        atm_strike_check_interval : 30000,
        strikes_after_before_atm : 5,   //Default value
    },

    straddle: {
        strategy: "long",
        atm_pct_diff: 10,   // Default atm_pct_diff
        profit : 1000,
        loss : -1000,
        lots : 1,       //Default number of lots
        monitor_interval: 1000,                     //Monitor if the prices match the percentage diff to start straddle
        atm_premium_monitor_interval : 30000,       //Check whether ATM premium is changed

        retry_count : 1,
        bank_nifty: {
            tolerate_deviation: 180,
        },
        nifty : {
            tolerate_deviation: 100,
        },
        fin_nifty : {
            tolerate_deviation: 100,
        }
    },

    strangle: {
        profit : 500,
        loss : -1000,
        monitor_interval: 1000,
        retry_count : 1,
        deploy_hedge : true,
        lots : 1,            //Default number of lots

        bank_nifty: {
            strangle_distance_points : 500,
            hedge_distance_points: 300,
        },
        nifty : {
            strangle_distance_points : 200,
            hedge_distance_points: 100,
        },
        fin_nifty : {
            strangle_distance_points : 200,
            hedge_distance_points: 100,
        },

        delay_SL : 60,          // In seconds.. Delay SL by these many seconds
    },

    alert_profit_threshold : 50, //Alert once the profit % exceeds the specified value
    alert_loss_threshold : 50, //Alert once the loss % exceeds the specified value
    target_sl_check_interval : 500, // In Milliseconds. Check for target and SL after every 500 ms
    heartbeat_timeout : 7000,
    alert_msg_disappear_after : 6000, // Unit milliseconds
    alert_error_disappear_after : 10000, // Unit milliseconds
}