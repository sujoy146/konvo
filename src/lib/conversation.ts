export const getConversationId = (a: string, b: string): string => {
  return [a, b].sort().join("_");
};
