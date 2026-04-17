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
export function callAnthropicAPI(provider, apiKey, model, messages, context, systemPrompt) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
        };
        // Build system prompt
        const systemParts = [];
        if (systemPrompt) {
            systemParts.push(systemPrompt);
        }
        if (context) {
            systemParts.push(context);
        }
        // Build messages array (Anthropic format)
        const apiMessages = [];
        for (const m of messages) {
            apiMessages.push({ role: m.role, content: m.content });
        }
        const requestBody = {
            model: model,
            max_tokens: 4096,
            messages: apiMessages,
        };
        if (systemParts.length > 0) {
            requestBody.system = systemParts.join("\n\n");
        }
        // Normalize baseUrl - remove trailing slash and ensure correct path
        const baseUrl = provider.baseUrl.replace(/\/+$/, "");
        const response = yield requestUrl({
            url: `${baseUrl}/v1/messages`,
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
            throw: false,
        });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Anthropic API error: ${response.status} - ${response.text}`);
        }
        const data = response.json;
        // Anthropic returns content as an array of content blocks
        if (data.content && Array.isArray(data.content)) {
            return data.content
                .filter((block) => block.type === "text")
                .map((block) => block.text)
                .join("");
        }
        return "No response";
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW50aHJvcGljLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYW50aHJvcGljLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHdEMsTUFBTSxVQUFnQixnQkFBZ0IsQ0FBQyxRQUF3QixFQUFFLE1BQWMsRUFBRSxLQUFhLEVBQUUsUUFBdUIsRUFBRSxPQUFlLEVBQUUsWUFBb0I7O1FBQzdKLE1BQU0sT0FBTyxHQUEyQjtZQUN2QyxjQUFjLEVBQUUsa0JBQWtCO1lBQ2xDLFdBQVcsRUFBRSxNQUFNO1lBQ25CLG1CQUFtQixFQUFFLFlBQVk7WUFDakMsMkNBQTJDLEVBQUUsTUFBTTtTQUNuRCxDQUFDO1FBRUYsc0JBQXNCO1FBQ3RCLE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztRQUNqQyxJQUFJLFlBQVksRUFBRSxDQUFDO1lBQ2xCLFdBQVcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDaEMsQ0FBQztRQUNELElBQUksT0FBTyxFQUFFLENBQUM7WUFDYixXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzNCLENBQUM7UUFFRCwwQ0FBMEM7UUFDMUMsTUFBTSxXQUFXLEdBQXdDLEVBQUUsQ0FBQztRQUM1RCxLQUFLLE1BQU0sQ0FBQyxJQUFJLFFBQVEsRUFBRSxDQUFDO1lBQzFCLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDeEQsQ0FBQztRQUVELE1BQU0sV0FBVyxHQUE0QjtZQUM1QyxLQUFLLEVBQUUsS0FBSztZQUNaLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLFFBQVEsRUFBRSxXQUFXO1NBQ3JCLENBQUM7UUFFRixJQUFJLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDNUIsV0FBVyxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9DLENBQUM7UUFFRCxvRUFBb0U7UUFDcEUsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3JELE1BQU0sUUFBUSxHQUFHLE1BQU0sVUFBVSxDQUFDO1lBQ2pDLEdBQUcsRUFBRSxHQUFHLE9BQU8sY0FBYztZQUM3QixNQUFNLEVBQUUsTUFBTTtZQUNkLE9BQU87WUFDUCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUM7WUFDakMsS0FBSyxFQUFFLEtBQUs7U0FDWixDQUFDLENBQUM7UUFFSCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsR0FBRyxJQUFJLFFBQVEsQ0FBQyxNQUFNLElBQUksR0FBRyxFQUFFLENBQUM7WUFDckQsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsUUFBUSxDQUFDLE1BQU0sTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMvRSxDQUFDO1FBRUQsTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztRQUMzQiwwREFBMEQ7UUFDMUQsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakQsT0FBTyxJQUFJLENBQUMsT0FBTztpQkFDakIsTUFBTSxDQUFDLENBQUMsS0FBdUIsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxNQUFNLENBQUM7aUJBQzFELEdBQUcsQ0FBQyxDQUFDLEtBQXVCLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7aUJBQzVDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNaLENBQUM7UUFDRCxPQUFPLGFBQWEsQ0FBQztJQUN0QixDQUFDO0NBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZXF1ZXN0VXJsIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBQcm92aWRlckNvbmZpZywgQ2hhdE1lc3NhZ2UgfSBmcm9tIFwiLi4vdHlwZXNcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGxBbnRocm9waWNBUEkocHJvdmlkZXI6IFByb3ZpZGVyQ29uZmlnLCBhcGlLZXk6IHN0cmluZywgbW9kZWw6IHN0cmluZywgbWVzc2FnZXM6IENoYXRNZXNzYWdlW10sIGNvbnRleHQ6IHN0cmluZywgc3lzdGVtUHJvbXB0OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuXHRcdFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuXHRcdFwieC1hcGkta2V5XCI6IGFwaUtleSxcblx0XHRcImFudGhyb3BpYy12ZXJzaW9uXCI6IFwiMjAyMy0wNi0wMVwiLFxuXHRcdFwiYW50aHJvcGljLWRhbmdlcm91cy1kaXJlY3QtYnJvd3Nlci1hY2Nlc3NcIjogXCJ0cnVlXCIsXG5cdH07XG5cblx0Ly8gQnVpbGQgc3lzdGVtIHByb21wdFxuXHRjb25zdCBzeXN0ZW1QYXJ0czogc3RyaW5nW10gPSBbXTtcblx0aWYgKHN5c3RlbVByb21wdCkge1xuXHRcdHN5c3RlbVBhcnRzLnB1c2goc3lzdGVtUHJvbXB0KTtcblx0fVxuXHRpZiAoY29udGV4dCkge1xuXHRcdHN5c3RlbVBhcnRzLnB1c2goY29udGV4dCk7XG5cdH1cblxuXHQvLyBCdWlsZCBtZXNzYWdlcyBhcnJheSAoQW50aHJvcGljIGZvcm1hdClcblx0Y29uc3QgYXBpTWVzc2FnZXM6IHsgcm9sZTogc3RyaW5nOyBjb250ZW50OiBzdHJpbmcgfVtdID0gW107XG5cdGZvciAoY29uc3QgbSBvZiBtZXNzYWdlcykge1xuXHRcdGFwaU1lc3NhZ2VzLnB1c2goeyByb2xlOiBtLnJvbGUsIGNvbnRlbnQ6IG0uY29udGVudCB9KTtcblx0fVxuXG5cdGNvbnN0IHJlcXVlc3RCb2R5OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcblx0XHRtb2RlbDogbW9kZWwsXG5cdFx0bWF4X3Rva2VuczogNDA5Nixcblx0XHRtZXNzYWdlczogYXBpTWVzc2FnZXMsXG5cdH07XG5cblx0aWYgKHN5c3RlbVBhcnRzLmxlbmd0aCA+IDApIHtcblx0XHRyZXF1ZXN0Qm9keS5zeXN0ZW0gPSBzeXN0ZW1QYXJ0cy5qb2luKFwiXFxuXFxuXCIpO1xuXHR9XG5cblx0Ly8gTm9ybWFsaXplIGJhc2VVcmwgLSByZW1vdmUgdHJhaWxpbmcgc2xhc2ggYW5kIGVuc3VyZSBjb3JyZWN0IHBhdGhcblx0Y29uc3QgYmFzZVVybCA9IHByb3ZpZGVyLmJhc2VVcmwucmVwbGFjZSgvXFwvKyQvLCBcIlwiKTtcblx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcblx0XHR1cmw6IGAke2Jhc2VVcmx9L3YxL21lc3NhZ2VzYCxcblx0XHRtZXRob2Q6IFwiUE9TVFwiLFxuXHRcdGhlYWRlcnMsXG5cdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkocmVxdWVzdEJvZHkpLFxuXHRcdHRocm93OiBmYWxzZSxcblx0fSk7XG5cblx0aWYgKHJlc3BvbnNlLnN0YXR1cyA8IDIwMCB8fCByZXNwb25zZS5zdGF0dXMgPj0gMzAwKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBBbnRocm9waWMgQVBJIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c30gLSAke3Jlc3BvbnNlLnRleHR9YCk7XG5cdH1cblxuXHRjb25zdCBkYXRhID0gcmVzcG9uc2UuanNvbjtcblx0Ly8gQW50aHJvcGljIHJldHVybnMgY29udGVudCBhcyBhbiBhcnJheSBvZiBjb250ZW50IGJsb2Nrc1xuXHRpZiAoZGF0YS5jb250ZW50ICYmIEFycmF5LmlzQXJyYXkoZGF0YS5jb250ZW50KSkge1xuXHRcdHJldHVybiBkYXRhLmNvbnRlbnRcblx0XHRcdC5maWx0ZXIoKGJsb2NrOiB7IHR5cGU6IHN0cmluZyB9KSA9PiBibG9jay50eXBlID09PSBcInRleHRcIilcblx0XHRcdC5tYXAoKGJsb2NrOiB7IHRleHQ6IHN0cmluZyB9KSA9PiBibG9jay50ZXh0KVxuXHRcdFx0LmpvaW4oXCJcIik7XG5cdH1cblx0cmV0dXJuIFwiTm8gcmVzcG9uc2VcIjtcbn1cbiJdfQ==