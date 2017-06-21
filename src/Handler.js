const { isUndefined, isObject, isFunction } = require('lodash');
const Controller = require('./Controller');
const HandlerUtil = require('./HandlerUtil');

/**
 * 
 * @typedef HandlerOptions
 * @type {Object}
 * 
 * @prop {function} handler
 * @prop {string} path Path relative to the controller's base path when the handler should be fired
 * @prop {string} method Which HTTP method when the path is met
 * @prop {string} description What does this handler do?
 * @prop {Param[]} params The params should be validated for this request
 * @prop {Response[]} responses
 * @prop {Express.IRouterHandler[]} before
 * @prop {Express.IRouterHandler[]} after
 * @property {type} name description
 */

/**
 * 
 * 
 * @class Handler
 */

class Handler {
  /**
   * Creates an instance of Handler.
   * @param {HandlerOptions} options Options for the handler
   * 
   * @memberOf Handler
   */
  constructor(options) {
    if (!isObject(options)) {
      throw new ReferenceError('Options object not passed to Handler');
    }
    if (!isFunction(options.handler)) {
      throw new ReferenceError('Handler.handler is not a function');
    }

    let {
      path = '/',
      method = 'get',
      description = 'No description',
      params = [],
      responses = [],
      handler,
      before = [],
      after = []
    } = options;

    this.path = path;
    this.method = method;
    this.description = description;
    this.params = params;
    this.handler = handler;
    this.responses = responses;
    this.before = before;
    this.after = after;
  }

  attachToController(ctrl) {
    ctrl[this.method](this);
  }

  getRouteHandler() {
    return async (req, res, next) => {
      let paramObj = {};
      let invalidResults = this.params
        .map(param => param.validateRequest(req, paramObj))
        .filter(result => !result.valid);

      if (invalidResults.length > 0) {
        return res.status(400)
          .send(invalidResults.map(result => result.reason).join());
      } else {

        let responses = this.responses
          .reduce((responses, response) => {
            responses[response._name || response.statusCode] = response.getResp().bind(response);
            return responses;
          }, {});

        let errorHandler = this._controller.errorHandler;

        try {
          let utils = new HandlerUtil(req);
          let result = await this.handler(paramObj, responses, utils, req, res, next);
          if (isUndefined(result)) {
            res.status(500).send(`No result for ${this.path}`);
          } else {
            res.status(result.statusCode).send(result.response);
          }
        } catch (err) {
          return errorHandler(err, req, res, next);
        }
      }
    };
  }
}

module.exports = Handler;