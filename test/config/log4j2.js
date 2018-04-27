module.exports = {
    "appenders": {
        "console": {"type": "console","layout": {type:"detail"}}
    },
    "categories": {
        "default": {"appenders": ["console"], "level": "trace"},
        "core": {"appenders": ["console"], "level": "trace"}
    }
}

