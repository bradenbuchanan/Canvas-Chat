var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { callOpenAIAPI } from "./openai";
import { callAnthropicAPI } from "./anthropic";
import { callGoogleAPI } from "./google";
export { callOpenAIAPI } from "./openai";
export { callAnthropicAPI } from "./anthropic";
export { callGoogleAPI } from "./google";
export function callLLM(provider_1, apiKey_1, model_1, messages_1) {
    return __awaiter(this, arguments, void 0, function* (provider, apiKey, model, messages, context = "", systemPrompt = "") {
        const apiFormat = provider.apiFormat || "openai";
        switch (apiFormat) {
            case "anthropic":
                return callAnthropicAPI(provider, apiKey, model, messages, context, systemPrompt);
            case "google":
                return callGoogleAPI(provider, apiKey, model, messages, context, systemPrompt);
            case "openai":
            default:
                return callOpenAIAPI(provider, apiKey, model, messages, context, systemPrompt);
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFDQSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQ3pDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRXpDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDekMsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQy9DLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFFekMsTUFBTSxVQUFnQixPQUFPO3lEQUFDLFFBQXdCLEVBQUUsTUFBYyxFQUFFLEtBQWEsRUFBRSxRQUF1QixFQUFFLFVBQWtCLEVBQUUsRUFBRSxlQUF1QixFQUFFO1FBQzlKLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxTQUFTLElBQUksUUFBUSxDQUFDO1FBRWpELFFBQVEsU0FBUyxFQUFFLENBQUM7WUFDbkIsS0FBSyxXQUFXO2dCQUNmLE9BQU8sZ0JBQWdCLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQztZQUNuRixLQUFLLFFBQVE7Z0JBQ1osT0FBTyxhQUFhLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQztZQUNoRixLQUFLLFFBQVEsQ0FBQztZQUNkO2dCQUNDLE9BQU8sYUFBYSxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDakYsQ0FBQztJQUNGLENBQUM7Q0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFByb3ZpZGVyQ29uZmlnLCBDaGF0TWVzc2FnZSB9IGZyb20gXCIuLi90eXBlc1wiO1xuaW1wb3J0IHsgY2FsbE9wZW5BSUFQSSB9IGZyb20gXCIuL29wZW5haVwiO1xuaW1wb3J0IHsgY2FsbEFudGhyb3BpY0FQSSB9IGZyb20gXCIuL2FudGhyb3BpY1wiO1xuaW1wb3J0IHsgY2FsbEdvb2dsZUFQSSB9IGZyb20gXCIuL2dvb2dsZVwiO1xuXG5leHBvcnQgeyBjYWxsT3BlbkFJQVBJIH0gZnJvbSBcIi4vb3BlbmFpXCI7XG5leHBvcnQgeyBjYWxsQW50aHJvcGljQVBJIH0gZnJvbSBcIi4vYW50aHJvcGljXCI7XG5leHBvcnQgeyBjYWxsR29vZ2xlQVBJIH0gZnJvbSBcIi4vZ29vZ2xlXCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxsTExNKHByb3ZpZGVyOiBQcm92aWRlckNvbmZpZywgYXBpS2V5OiBzdHJpbmcsIG1vZGVsOiBzdHJpbmcsIG1lc3NhZ2VzOiBDaGF0TWVzc2FnZVtdLCBjb250ZXh0OiBzdHJpbmcgPSBcIlwiLCBzeXN0ZW1Qcm9tcHQ6IHN0cmluZyA9IFwiXCIpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRjb25zdCBhcGlGb3JtYXQgPSBwcm92aWRlci5hcGlGb3JtYXQgfHwgXCJvcGVuYWlcIjtcblxuXHRzd2l0Y2ggKGFwaUZvcm1hdCkge1xuXHRcdGNhc2UgXCJhbnRocm9waWNcIjpcblx0XHRcdHJldHVybiBjYWxsQW50aHJvcGljQVBJKHByb3ZpZGVyLCBhcGlLZXksIG1vZGVsLCBtZXNzYWdlcywgY29udGV4dCwgc3lzdGVtUHJvbXB0KTtcblx0XHRjYXNlIFwiZ29vZ2xlXCI6XG5cdFx0XHRyZXR1cm4gY2FsbEdvb2dsZUFQSShwcm92aWRlciwgYXBpS2V5LCBtb2RlbCwgbWVzc2FnZXMsIGNvbnRleHQsIHN5c3RlbVByb21wdCk7XG5cdFx0Y2FzZSBcIm9wZW5haVwiOlxuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gY2FsbE9wZW5BSUFQSShwcm92aWRlciwgYXBpS2V5LCBtb2RlbCwgbWVzc2FnZXMsIGNvbnRleHQsIHN5c3RlbVByb21wdCk7XG5cdH1cbn1cbiJdfQ==