import { DenockOptions, Interceptor } from "./type.ts";

import { formatTargetUrlFromOptions } from "./formatTargetUrlFromOptions.ts";
import { extractMethodAndBodyFromRequestInitObject } from "./extractMethodAndBodyFromRequestInitObject.ts";
import { extractBodyFromRequest } from "./extractBodyFromRequest.ts";
import { verifyMatch } from "./verifyMatch.ts";
import { determineInputType } from "./typeguard.ts";

function denock(options: DenockOptions): Interceptor {
  const originalFetch = window.fetch;
  let callCounter = 0;
  let callLimit = 1;

  const { responseHeaders, responseBody, interception, replyStatus } = options;

  callLimit = interception || 1;

  const targetURl = formatTargetUrlFromOptions(options);

  window.fetch = async (
    input: string | Request | URL,
    init?: RequestInit | undefined,
  ) => {
    callCounter++;

    try {
      const inputTypeResult = determineInputType(input);

      let originalUrl: string;

      let {
        originalBody,
        originalMethod,
        originalHeaders,
      } = extractMethodAndBodyFromRequestInitObject(init);

      switch (inputTypeResult.type) {
        case "string":
          originalUrl = inputTypeResult.stringURL;
          break;

        case "url":
          originalUrl = inputTypeResult.url.toString();
          break;

        case "request":
          const request = inputTypeResult.request;
          originalUrl = inputTypeResult.request.url;
          originalMethod = inputTypeResult.request.method.toUpperCase();

          if (request.body) {
            const readableStreamReader = request.body?.getReader();
            const extractedBody = await extractBodyFromRequest(
              readableStreamReader,
            );
            originalBody = extractedBody ? extractedBody : originalBody;
          }

          originalHeaders = request.headers;
          break;

        default:
          const unknownType: never = inputTypeResult;
          throw new TypeError(`Denock: Unknown type for input: ${unknownType}`);
          break;
      }

      verifyMatch(targetURl, options, {
        originalUrl,
        originalBody,
        originalMethod,
        originalHeaders,
      });
    } catch (err) {
      window.fetch = originalFetch;
      throw err;
    }

    if (callLimit === callCounter) {
      window.fetch = originalFetch;
    }

    const status = replyStatus || 200;

    return {
      status,
      ok: status >= 200 && status <= 299,
      headers: responseHeaders,
      json: () => responseBody as any,
    } as Response;
  };

  return {
    destroy: () => {
      window.fetch = originalFetch;
    },
    called: () => {
      return callCounter;
    },
  };
}

export { denock };
