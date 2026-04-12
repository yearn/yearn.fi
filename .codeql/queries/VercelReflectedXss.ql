/**
 * @name Reflected XSS in Vercel serverless function
 * @description User input from VercelRequest query parameters is interpolated
 *              into an HTML response without sanitization, enabling cross-site
 *              scripting attacks.
 * @kind path-problem
 * @problem.severity error
 * @security-severity 7.8
 * @precision high
 * @id js/vercel-reflected-xss
 * @tags security
 *       external/cwe/cwe-079
 */

import javascript
import semmle.javascript.security.dataflow.ReflectedXssQuery
import ReflectedXssFlow::PathGraph

/** A Vercel serverless function handler identified by a VercelRequest-typed first parameter. */
class VercelRouteHandler extends Http::Servers::StandardRouteHandler, DataFlow::FunctionNode {
  VercelRouteHandler() {
    this.getParameter(0).hasUnderlyingType("@vercel/node", "VercelRequest")
  }
}

/** The first parameter of a Vercel handler, typed as VercelRequest. */
class VercelRequestSource extends Http::Servers::RequestSource {
  VercelRouteHandler rh;

  VercelRequestSource() { this = rh.getParameter(0) }

  override Http::RouteHandler getRouteHandler() { result = rh }
}

/** The second parameter of a Vercel handler, typed as VercelResponse. */
class VercelResponseSource extends Http::Servers::ResponseSource {
  VercelRouteHandler rh;

  VercelResponseSource() {
    this = rh.getParameter(1) and
    this.hasUnderlyingType("@vercel/node", "VercelResponse")
  }

  override Http::RouteHandler getRouteHandler() { result = rh }
}

/** A chained response object from calls like res.status(200), res.type(), res.set(). */
class VercelChainedResponseSource extends Http::Servers::ResponseSource {
  VercelRouteHandler rh;

  VercelChainedResponseSource() {
    exists(VercelResponseSource src |
      this = src.ref().getAMethodCall(["status", "type", "set"]) and
      rh = src.getRouteHandler()
    )
  }

  override Http::RouteHandler getRouteHandler() { result = rh }
}

/** Access to user-controlled input on a VercelRequest: query, body, headers, cookies. */
class VercelRequestInputAccess extends Http::RequestInputAccess {
  VercelRouteHandler rh;
  string kind;

  VercelRequestInputAccess() {
    exists(VercelRequestSource src |
      rh = src.getRouteHandler() and
      (
        this = src.ref().getAPropertyRead("query") and kind = "parameter"
        or
        this = src.ref().getAPropertyRead("body") and kind = "body"
        or
        this = src.ref().getAPropertyRead("headers") and kind = "header"
        or
        this = src.ref().getAPropertyRead("cookies") and kind = "cookie"
      )
    )
  }

  override Http::RouteHandler getRouteHandler() { result = rh }

  override string getKind() { result = kind }

  override predicate isThirdPartyControllable() { any() }
}

/** Argument to .send() on a VercelResponse, including chained calls like res.status(200).send(). */
class VercelResponseSendArgument extends Http::ResponseSendArgument {
  VercelRouteHandler rh;

  VercelResponseSendArgument() {
    exists(VercelResponseSource src |
      this = src.ref().getAMethodCall("send").getArgument(0) and
      rh = src.getRouteHandler()
    )
    or
    exists(VercelChainedResponseSource chained |
      this = chained.ref().getAMethodCall("send").getArgument(0) and
      rh = chained.getRouteHandler()
    )
  }

  override Http::RouteHandler getRouteHandler() { result = rh }
}

/** A call to res.setHeader() on a VercelResponse. */
class VercelHeaderDefinition extends Http::ExplicitHeaderDefinition, DataFlow::CallNode {
  VercelRouteHandler rh;

  VercelHeaderDefinition() {
    exists(VercelResponseSource src |
      this = src.ref().getAMethodCall("setHeader") and
      rh = src.getRouteHandler()
    )
  }

  override Http::RouteHandler getRouteHandler() { result = rh }

  override predicate definesHeaderValue(string name, DataFlow::Node value) {
    name = this.getArgument(0).getStringValue().toLowerCase() and
    value = this.getArgument(1)
  }

  override DataFlow::Node getNameNode() { result = this.getArgument(0) }
}

from ReflectedXssFlow::PathNode source, ReflectedXssFlow::PathNode sink
where ReflectedXssFlow::flowPath(source, sink)
select sink.getNode(), source, sink,
  "Cross-site scripting vulnerability due to a $@.", source.getNode(), "user-provided value"
