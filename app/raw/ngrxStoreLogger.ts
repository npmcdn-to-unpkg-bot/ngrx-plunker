
declare var console;

const logger = console;
const INIT_ACTION = "@ngrx/store/init";

const repeat = (str, times) => (new Array(times + 1)).join(str);
const pad = (num, maxLength) => repeat(`0`, maxLength - num.toString().length) + num;
const formatTime = (time) => `@ ${pad(time.getHours(), 2)}:${pad(time.getMinutes(), 2)}:${pad(time.getSeconds(), 2)}.${pad(time.getMilliseconds(), 3)}`;
const timer = typeof performance !== `undefined` && typeof performance.now === `function` ? performance : Date;

const getLogLevel = (level, action, payload, type) => {
    switch (typeof level) {
        case `object`:
            return typeof level[type] === `function` ? level[type](...payload) : level[type];
        case `function`:
            return level(action);
        default:
            return level;
    }
};

const printBuffer = options => logBuffer => {
    const {actionTransformer, collapsed, colors, timestamp, duration, level} = options;
    logBuffer.forEach((logEntry, key) => {
        const { started, startedTime, action, error } = logEntry;
        const prevState = logEntry.prevState.nextState ? logEntry.prevState.nextState : '(Empty)';
        let { took, nextState } = logEntry;
        const nextEntry = logBuffer[key + 1];
        if (nextEntry) {
            nextState = nextEntry.prevState;
            took = nextEntry.started - started;
        }

        const formattedAction = actionTransformer(action);
        const isCollapsed = (typeof collapsed === `function`) ? collapsed(() => nextState, action) : collapsed;

        const formattedTime = formatTime(startedTime);
        const titleCSS = colors.title ? `color: ${colors.title(formattedAction)};` : null;
        const title = `action ${timestamp ? formattedTime : ``} ${formattedAction.type} ${duration ? `(in ${took.toFixed(2)} ms)` : ``}`;

        try {
            if (isCollapsed) {
                if (colors.title) logger.groupCollapsed(`%c ${title}`, titleCSS);
                else logger.groupCollapsed(title);
            } else {
                if (colors.title) logger.group(`%c ${title}`, titleCSS);
                else logger.group(title);
            }
        } catch (e) {
            logger.log(title);
        }

        const prevStateLevel = getLogLevel(level, formattedAction, [prevState], `prevState`);
        const actionLevel = getLogLevel(level, formattedAction, [formattedAction], `action`);
        const errorLevel = getLogLevel(level, formattedAction, [error, prevState], `error`);
        const nextStateLevel = getLogLevel(level, formattedAction, [nextState], `nextState`);

        if (prevStateLevel) {
            if (colors.prevState) logger[prevStateLevel](`%c prev state`, `color: ${colors.prevState(prevState)}; font-weight: bold`, prevState);
            else logger[prevStateLevel](`prev state`, prevState);
        }

        if (actionLevel) {
            if (colors.action) logger[actionLevel](`%c action`, `color: ${colors.action(formattedAction)}; font-weight: bold`, formattedAction);
            else logger[actionLevel](`action`, formattedAction);
        }

        if (error && errorLevel) {
            if (colors.error) logger[errorLevel](`%c error`, `color: ${colors.error(error, prevState)}; font-weight: bold`, error);
            else logger[errorLevel](`error`, error);
        }

        if (nextStateLevel) {
            if (colors.nextState) logger[nextStateLevel](`%c next state`, `color: ${colors.nextState(nextState)}; font-weight: bold`, nextState);
            else logger[nextStateLevel](`next state`, nextState);
        }

        try {
            logger.groupEnd();
        } catch (e) {
            logger.log(`—— log end ——`);
        }
    });
    logBuffer.length = 0;
};

export const storeLogger = (opts : Object = {}) => (reducer : Function) => {
    let log = {};
    const ua = window && window.navigator.userAgent ? window.navigator.userAgent : '';
    let ms_ie = false;
    //fix for action display in IE
    const old_ie = ua.indexOf('MSIE ');
    const new_ie = ua.indexOf('Trident/');

    if ((old_ie > -1) || (new_ie > -1)) {
        ms_ie = true;
    }

    const defaults = {
        level : `log`,
        collapsed : false,
        duration : true,
        timestamp : true,
        stateTransformer : state => state,
        actionTransformer : actn => actn,
        colors : ms_ie ? {} : {
            title: () => `#000000`,
            prevState: () => `#9E9E9E`,
            action: () => `#03A9F4`,
            nextState: () => `#4CAF50`,
            error: () => `#F20404`,
        }
    };

    const options = Object.assign({}, defaults, opts);
    const {stateTransformer} = options;
    const buffer = printBuffer(options);

    return function(state, action) {
        let preLog = {
            started: timer.now(),
            startedTime: new Date(),
            prevState: stateTransformer(log),
            action
        };

        let nextState = reducer(state, action);

        let postLog = {
            took: timer.now() - preLog.started,
            nextState: stateTransformer(nextState)
        };
        log = Object.assign({}, preLog, postLog);
        //ignore init action fired by store and devtools
        if(action.type !== INIT_ACTION) {
            buffer([log]);
        }

        return nextState;
    }
};