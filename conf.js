conf = window.conf || {};
conf = {
    broker : {
        shoonya: {
            user_id: "FA90807",    // FA85460
            session_token: "6d3b852cc350f1d449ba418bb3e957fb724701858a2302273db850c58416ee2e",
        },
        kite : {
            user_id : "VC1177",
            session_token : "cwWX0YPrv9XOc9zKLnLSC2JX2+8gDHTp66uhFxuilxlosDywQAOy7qBlaM/2XsgPG1SzQYoEBJM+CCFCBJWv3IBODW8WHv44Z15sHETZK1Y+oTag2xF38w=="
        }
    },

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

    spreads : {
        instrument : "bank_nifty",  // Default instrument..  nifty, bank_nifty, fin_nifty are the allowed values
        atm_strike_check_interval : 30000,
        strikes_after_before_atm : 5,   //Default value
    },

    straddle: {
        atm_pct_diff: 1000000,
        profit : 1000,
        loss : -1000,
        lots : 1,       //Default
        monitor_interval: 1000,
        atm_premium_monitor_interval : 30000,

        retry_count : 1,
        bank_nifty: {
            tolerate_deviation: 180,
            qty: 15,
            round_to: 100,
        },
        nifty : {
            tolerate_deviation: 100,
            qty: 50,
            round_to: 50,
        },
        fin_nifty : {
            tolerate_deviation: 100,
            qty: 40,
            round_to: 50,
        }
    },

    strangle: {
        profit : 500,
        loss : -1000,
        monitor_interval: 1000,
        retry_count : 1,
        deploy_hedge : true,
        lots : 1,

        bank_nifty: {
            strangle_distance_points : 500,
            hedge_distance_points: 300,
            qty: 15,
            round_to: 100,
        },
        nifty : {
            strangle_distance_points : 200,
            hedge_distance_points: 100,
            qty: 50,
            round_to: 50,
        },
        fin_nifty : {
            strangle_distance_points : 200,
            hedge_distance_points: 100,
            qty: 40,
            round_to: 50,
        },

        delay_SL : 60,          // In seconds.. Delay SL by these many seconds
    },

    alert_profit_threshold : 50, //Alert once the profit % exceeds the specified value
    alert_loss_threshold : 50, //Alert once the loss % exceeds the specified value
    target_sl_check_interval : 500, // In Milliseconds. Check for target and SL after every 500 ms
    heartbeat_timeout : 7000,
    alert_msg_disappear_after : 3000, // Unit milliseconds
}