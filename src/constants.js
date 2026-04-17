export const VIEW_TYPE_CANVAS_CHAT = "canvas-chat-view";
export const FILE_EXTENSION = "canvaschat";
export const DEFAULT_CONTEXT_TEMPLATE = `--- {filepath} ---
{content}`;
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You help users with their questions and tasks. When context files are provided, use them to give more accurate and relevant answers. Be concise but thorough.`;
export const DEFAULT_SETTINGS = {
    customOpenRouterModels: "",
    providers: [
        {
            name: "OpenAI",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "",
            models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
            enabled: true,
            apiFormat: "openai"
        },
        {
            name: "OpenRouter",
            baseUrl: "https://openrouter.ai/api/v1",
            apiKey: "",
            models: ["anthropic/claude-3.5-sonnet", "anthropic/claude-3-opus", "openai/gpt-4o", "google/gemini-pro-1.5"],
            enabled: true,
            apiFormat: "openai"
        },
        {
            name: "Anthropic",
            baseUrl: "https://api.anthropic.com",
            apiKey: "",
            models: ["claude-sonnet-4-5", "claude-sonnet-4-5-thinking", "claude-opus-4-5-thinking"],
            enabled: true,
            apiFormat: "anthropic"
        },
        {
            name: "Google",
            baseUrl: "https://generativelanguage.googleapis.com/v1beta",
            apiKey: "",
            models: ["gemini-2.5-flash", "gemini-2.5-flash-thinking", "gemini-3-flash", "gemini-3-pro-high", "gemini-3-pro-low"],
            enabled: true,
            apiFormat: "google"
        }
    ]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29uc3RhbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFHLGtCQUFrQixDQUFDO0FBQ3hELE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUM7QUFFM0MsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQUc7VUFDOUIsQ0FBQztBQUVYLE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFHLCtMQUErTCxDQUFDO0FBRXJPLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFtQjtJQUMvQyxzQkFBc0IsRUFBRSxFQUFFO0lBQzFCLFNBQVMsRUFBRTtRQUNWO1lBQ0MsSUFBSSxFQUFFLFFBQVE7WUFDZCxPQUFPLEVBQUUsMkJBQTJCO1lBQ3BDLE1BQU0sRUFBRSxFQUFFO1lBQ1YsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLGFBQWEsRUFBRSxhQUFhLEVBQUUsZUFBZSxDQUFDO1lBQ2pFLE9BQU8sRUFBRSxJQUFJO1lBQ2IsU0FBUyxFQUFFLFFBQVE7U0FDbkI7UUFDRDtZQUNDLElBQUksRUFBRSxZQUFZO1lBQ2xCLE9BQU8sRUFBRSw4QkFBOEI7WUFDdkMsTUFBTSxFQUFFLEVBQUU7WUFDVixNQUFNLEVBQUUsQ0FBQyw2QkFBNkIsRUFBRSx5QkFBeUIsRUFBRSxlQUFlLEVBQUUsdUJBQXVCLENBQUM7WUFDNUcsT0FBTyxFQUFFLElBQUk7WUFDYixTQUFTLEVBQUUsUUFBUTtTQUNuQjtRQUNEO1lBQ0MsSUFBSSxFQUFFLFdBQVc7WUFDakIsT0FBTyxFQUFFLDJCQUEyQjtZQUNwQyxNQUFNLEVBQUUsRUFBRTtZQUNWLE1BQU0sRUFBRSxDQUFDLG1CQUFtQixFQUFFLDRCQUE0QixFQUFFLDBCQUEwQixDQUFDO1lBQ3ZGLE9BQU8sRUFBRSxJQUFJO1lBQ2IsU0FBUyxFQUFFLFdBQVc7U0FDdEI7UUFDRDtZQUNDLElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLGtEQUFrRDtZQUMzRCxNQUFNLEVBQUUsRUFBRTtZQUNWLE1BQU0sRUFBRSxDQUFDLGtCQUFrQixFQUFFLDJCQUEyQixFQUFFLGdCQUFnQixFQUFFLG1CQUFtQixFQUFFLGtCQUFrQixDQUFDO1lBQ3BILE9BQU8sRUFBRSxJQUFJO1lBQ2IsU0FBUyxFQUFFLFFBQVE7U0FDbkI7S0FDRDtDQUNELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQbHVnaW5TZXR0aW5ncyB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCBjb25zdCBWSUVXX1RZUEVfQ0FOVkFTX0NIQVQgPSBcImNhbnZhcy1jaGF0LXZpZXdcIjtcbmV4cG9ydCBjb25zdCBGSUxFX0VYVEVOU0lPTiA9IFwiY2FudmFzY2hhdFwiO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT05URVhUX1RFTVBMQVRFID0gYC0tLSB7ZmlsZXBhdGh9IC0tLVxue2NvbnRlbnR9YDtcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU1lTVEVNX1BST01QVCA9IGBZb3UgYXJlIGEgaGVscGZ1bCBBSSBhc3Npc3RhbnQuIFlvdSBoZWxwIHVzZXJzIHdpdGggdGhlaXIgcXVlc3Rpb25zIGFuZCB0YXNrcy4gV2hlbiBjb250ZXh0IGZpbGVzIGFyZSBwcm92aWRlZCwgdXNlIHRoZW0gdG8gZ2l2ZSBtb3JlIGFjY3VyYXRlIGFuZCByZWxldmFudCBhbnN3ZXJzLiBCZSBjb25jaXNlIGJ1dCB0aG9yb3VnaC5gO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogUGx1Z2luU2V0dGluZ3MgPSB7XG5cdGN1c3RvbU9wZW5Sb3V0ZXJNb2RlbHM6IFwiXCIsXG5cdHByb3ZpZGVyczogW1xuXHRcdHtcblx0XHRcdG5hbWU6IFwiT3BlbkFJXCIsXG5cdFx0XHRiYXNlVXJsOiBcImh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjFcIixcblx0XHRcdGFwaUtleTogXCJcIixcblx0XHRcdG1vZGVsczogW1wiZ3B0LTRvXCIsIFwiZ3B0LTRvLW1pbmlcIiwgXCJncHQtNC10dXJib1wiLCBcImdwdC0zLjUtdHVyYm9cIl0sXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0YXBpRm9ybWF0OiBcIm9wZW5haVwiXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRuYW1lOiBcIk9wZW5Sb3V0ZXJcIixcblx0XHRcdGJhc2VVcmw6IFwiaHR0cHM6Ly9vcGVucm91dGVyLmFpL2FwaS92MVwiLFxuXHRcdFx0YXBpS2V5OiBcIlwiLFxuXHRcdFx0bW9kZWxzOiBbXCJhbnRocm9waWMvY2xhdWRlLTMuNS1zb25uZXRcIiwgXCJhbnRocm9waWMvY2xhdWRlLTMtb3B1c1wiLCBcIm9wZW5haS9ncHQtNG9cIiwgXCJnb29nbGUvZ2VtaW5pLXByby0xLjVcIl0sXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0YXBpRm9ybWF0OiBcIm9wZW5haVwiXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRuYW1lOiBcIkFudGhyb3BpY1wiLFxuXHRcdFx0YmFzZVVybDogXCJodHRwczovL2FwaS5hbnRocm9waWMuY29tXCIsXG5cdFx0XHRhcGlLZXk6IFwiXCIsXG5cdFx0XHRtb2RlbHM6IFtcImNsYXVkZS1zb25uZXQtNC01XCIsIFwiY2xhdWRlLXNvbm5ldC00LTUtdGhpbmtpbmdcIiwgXCJjbGF1ZGUtb3B1cy00LTUtdGhpbmtpbmdcIl0sXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0YXBpRm9ybWF0OiBcImFudGhyb3BpY1wiXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRuYW1lOiBcIkdvb2dsZVwiLFxuXHRcdFx0YmFzZVVybDogXCJodHRwczovL2dlbmVyYXRpdmVsYW5ndWFnZS5nb29nbGVhcGlzLmNvbS92MWJldGFcIixcblx0XHRcdGFwaUtleTogXCJcIixcblx0XHRcdG1vZGVsczogW1wiZ2VtaW5pLTIuNS1mbGFzaFwiLCBcImdlbWluaS0yLjUtZmxhc2gtdGhpbmtpbmdcIiwgXCJnZW1pbmktMy1mbGFzaFwiLCBcImdlbWluaS0zLXByby1oaWdoXCIsIFwiZ2VtaW5pLTMtcHJvLWxvd1wiXSxcblx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRhcGlGb3JtYXQ6IFwiZ29vZ2xlXCJcblx0XHR9XG5cdF1cbn07XG4iXX0=