/**
 * We use this to mock css modules. It defines a proxy and simply returns the given CSS property.
 * I.e: if a file uses styles.hide, then this will return 'hide'
 */

const target = {};

const handler = {
    get: (target, prop) => {
        return prop;
    },
};

const proxy = new Proxy(target, handler);
export default proxy;
