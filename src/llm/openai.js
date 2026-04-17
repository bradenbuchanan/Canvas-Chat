var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { requestUrl } from "obsidian";
export function callOpenAIAPI(provider, apiKey, model, messages, context, systemPrompt) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        };
        // OpenRouter requires additional headers
        if (provider.name === "OpenRouter") {
            headers["HTTP-Referer"] = "https://obsidian.md";
            headers["X-Title"] = "Canvas Chat";
        }
        // Build messages array with system prompt and context
        const apiMessages = [];
        // Combine system prompt and context
        const systemParts = [];
        if (systemPrompt) {
            systemParts.push(systemPrompt);
        }
        if (context) {
            systemParts.push(context);
        }
        if (systemParts.length > 0) {
            apiMessages.push({ role: "system", content: systemParts.join("\n\n") });
        }
        for (const m of messages) {
            apiMessages.push({ role: m.role, content: m.content });
        }
        // Normalize baseUrl - remove trailing slash
        const baseUrl = provider.baseUrl.replace(/\/+$/, "");
        const response = yield requestUrl({
            url: `${baseUrl}/chat/completions`,
            method: "POST",
            headers,
            body: JSON.stringify({
                model: model,
                messages: apiMessages,
            }),
            throw: false,
        });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`API error: ${response.status} - ${response.text}`);
        }
        const data = response.json;
        return ((_b = (_a = data.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "No response";
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbmFpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsib3BlbmFpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHdEMsTUFBTSxVQUFnQixhQUFhLENBQUMsUUFBd0IsRUFBRSxNQUFjLEVBQUUsS0FBYSxFQUFFLFFBQXVCLEVBQUUsT0FBZSxFQUFFLFlBQW9COzs7UUFDMUosTUFBTSxPQUFPLEdBQTJCO1lBQ3ZDLGNBQWMsRUFBRSxrQkFBa0I7WUFDbEMsZUFBZSxFQUFFLFVBQVUsTUFBTSxFQUFFO1NBQ25DLENBQUM7UUFFRix5Q0FBeUM7UUFDekMsSUFBSSxRQUFRLENBQUMsSUFBSSxLQUFLLFlBQVksRUFBRSxDQUFDO1lBQ3BDLE9BQU8sQ0FBQyxjQUFjLENBQUMsR0FBRyxxQkFBcUIsQ0FBQztZQUNoRCxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsYUFBYSxDQUFDO1FBQ3BDLENBQUM7UUFFRCxzREFBc0Q7UUFDdEQsTUFBTSxXQUFXLEdBQXdDLEVBQUUsQ0FBQztRQUU1RCxvQ0FBb0M7UUFDcEMsTUFBTSxXQUFXLEdBQWEsRUFBRSxDQUFDO1FBQ2pDLElBQUksWUFBWSxFQUFFLENBQUM7WUFDbEIsV0FBVyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNoQyxDQUFDO1FBQ0QsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNiLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDM0IsQ0FBQztRQUNELElBQUksV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM1QixXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDekUsQ0FBQztRQUVELEtBQUssTUFBTSxDQUFDLElBQUksUUFBUSxFQUFFLENBQUM7WUFDMUIsV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUN4RCxDQUFDO1FBRUQsNENBQTRDO1FBQzVDLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNyRCxNQUFNLFFBQVEsR0FBRyxNQUFNLFVBQVUsQ0FBQztZQUNqQyxHQUFHLEVBQUUsR0FBRyxPQUFPLG1CQUFtQjtZQUNsQyxNQUFNLEVBQUUsTUFBTTtZQUNkLE9BQU87WUFDUCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDcEIsS0FBSyxFQUFFLEtBQUs7Z0JBQ1osUUFBUSxFQUFFLFdBQVc7YUFDckIsQ0FBQztZQUNGLEtBQUssRUFBRSxLQUFLO1NBQ1osQ0FBQyxDQUFDO1FBRUgsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxRQUFRLENBQUMsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQ3JELE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxRQUFRLENBQUMsTUFBTSxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7UUFFRCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO1FBQzNCLE9BQU8sQ0FBQSxNQUFBLE1BQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsMENBQUUsT0FBTywwQ0FBRSxPQUFPLEtBQUksYUFBYSxDQUFDO0lBQzNELENBQUM7Q0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlcXVlc3RVcmwgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IFByb3ZpZGVyQ29uZmlnLCBDaGF0TWVzc2FnZSB9IGZyb20gXCIuLi90eXBlc1wiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsbE9wZW5BSUFQSShwcm92aWRlcjogUHJvdmlkZXJDb25maWcsIGFwaUtleTogc3RyaW5nLCBtb2RlbDogc3RyaW5nLCBtZXNzYWdlczogQ2hhdE1lc3NhZ2VbXSwgY29udGV4dDogc3RyaW5nLCBzeXN0ZW1Qcm9tcHQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdGNvbnN0IGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG5cdFx0XCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG5cdFx0XCJBdXRob3JpemF0aW9uXCI6IGBCZWFyZXIgJHthcGlLZXl9YCxcblx0fTtcblxuXHQvLyBPcGVuUm91dGVyIHJlcXVpcmVzIGFkZGl0aW9uYWwgaGVhZGVyc1xuXHRpZiAocHJvdmlkZXIubmFtZSA9PT0gXCJPcGVuUm91dGVyXCIpIHtcblx0XHRoZWFkZXJzW1wiSFRUUC1SZWZlcmVyXCJdID0gXCJodHRwczovL29ic2lkaWFuLm1kXCI7XG5cdFx0aGVhZGVyc1tcIlgtVGl0bGVcIl0gPSBcIkNhbnZhcyBDaGF0XCI7XG5cdH1cblxuXHQvLyBCdWlsZCBtZXNzYWdlcyBhcnJheSB3aXRoIHN5c3RlbSBwcm9tcHQgYW5kIGNvbnRleHRcblx0Y29uc3QgYXBpTWVzc2FnZXM6IHsgcm9sZTogc3RyaW5nOyBjb250ZW50OiBzdHJpbmcgfVtdID0gW107XG5cblx0Ly8gQ29tYmluZSBzeXN0ZW0gcHJvbXB0IGFuZCBjb250ZXh0XG5cdGNvbnN0IHN5c3RlbVBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuXHRpZiAoc3lzdGVtUHJvbXB0KSB7XG5cdFx0c3lzdGVtUGFydHMucHVzaChzeXN0ZW1Qcm9tcHQpO1xuXHR9XG5cdGlmIChjb250ZXh0KSB7XG5cdFx0c3lzdGVtUGFydHMucHVzaChjb250ZXh0KTtcblx0fVxuXHRpZiAoc3lzdGVtUGFydHMubGVuZ3RoID4gMCkge1xuXHRcdGFwaU1lc3NhZ2VzLnB1c2goeyByb2xlOiBcInN5c3RlbVwiLCBjb250ZW50OiBzeXN0ZW1QYXJ0cy5qb2luKFwiXFxuXFxuXCIpIH0pO1xuXHR9XG5cblx0Zm9yIChjb25zdCBtIG9mIG1lc3NhZ2VzKSB7XG5cdFx0YXBpTWVzc2FnZXMucHVzaCh7IHJvbGU6IG0ucm9sZSwgY29udGVudDogbS5jb250ZW50IH0pO1xuXHR9XG5cblx0Ly8gTm9ybWFsaXplIGJhc2VVcmwgLSByZW1vdmUgdHJhaWxpbmcgc2xhc2hcblx0Y29uc3QgYmFzZVVybCA9IHByb3ZpZGVyLmJhc2VVcmwucmVwbGFjZSgvXFwvKyQvLCBcIlwiKTtcblx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcblx0XHR1cmw6IGAke2Jhc2VVcmx9L2NoYXQvY29tcGxldGlvbnNgLFxuXHRcdG1ldGhvZDogXCJQT1NUXCIsXG5cdFx0aGVhZGVycyxcblx0XHRib2R5OiBKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRtb2RlbDogbW9kZWwsXG5cdFx0XHRtZXNzYWdlczogYXBpTWVzc2FnZXMsXG5cdFx0fSksXG5cdFx0dGhyb3c6IGZhbHNlLFxuXHR9KTtcblxuXHRpZiAocmVzcG9uc2Uuc3RhdHVzIDwgMjAwIHx8IHJlc3BvbnNlLnN0YXR1cyA+PSAzMDApIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoYEFQSSBlcnJvcjogJHtyZXNwb25zZS5zdGF0dXN9IC0gJHtyZXNwb25zZS50ZXh0fWApO1xuXHR9XG5cblx0Y29uc3QgZGF0YSA9IHJlc3BvbnNlLmpzb247XG5cdHJldHVybiBkYXRhLmNob2ljZXNbMF0/Lm1lc3NhZ2U/LmNvbnRlbnQgfHwgXCJObyByZXNwb25zZVwiO1xufVxuIl19