// A local vote response stays visible until a new server snapshot arrives.
export const resolvePollOptions = (serverOptions, localVote) =>
  localVote && localVote.sourceOptions === serverOptions ? localVote.options : (serverOptions || []);
