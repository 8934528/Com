#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <chrono>
#include <thread>
#include <mutex>
#include <queue>
#include <atomic>
#include <ctime>
#include <sstream>
#include <iomanip>
#include <cstring>

#ifdef _WIN32
#include <windows.h>
#include <winsock2.h>
#pragma comment(lib, "ws2_32.lib")
#else
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#endif

class JsonWriter
{
private:
    std::stringstream ss;
    bool first = true;

public:
    void startObject()
    {
        ss << "{";
        first = true;
    }

    void endObject()
    {
        ss << "}";
    }

    void startArray()
    {
        ss << "[";
        first = true;
    }

    void endArray()
    {
        ss << "]";
    }

    template <typename T>
    void addKeyValue(const std::string &key, const T &value)
    {
        if (!first)
            ss << ",";
        ss << "\"" << key << "\":\"" << value << "\"";
        first = false;
    }

    void addKeyValue(const std::string &key, int value)
    {
        if (!first)
            ss << ",";
        ss << "\"" << key << "\":" << value;
        first = false;
    }

    void addKeyValue(const std::string &key, bool value)
    {
        if (!first)
            ss << ",";
        ss << "\"" << key << "\":" << (value ? "true" : "false");
        first = false;
    }

    std::string toString() const
    {
        return ss.str();
    }
};

struct Message
{
    int id;
    std::string sender;
    std::string content;
    std::string timestamp;

    std::string toJson() const
    {
        JsonWriter jw;
        jw.startObject();
        jw.addKeyValue("id", id);
        jw.addKeyValue("sender", sender);
        jw.addKeyValue("content", content);
        jw.addKeyValue("timestamp", timestamp);
        jw.endObject();
        return jw.toString();
    }
};

class ConversationManager
{
private:
    std::vector<Message> messages;
    std::mutex mtx;
    std::string filename;

public:
    ConversationManager(const std::string &file) : filename(file)
    {
        loadFromFile();
    }

    void addMessage(const std::string &sender, const std::string &content)
    {
        std::lock_guard<std::mutex> lock(mtx);

        Message msg;
        msg.id = messages.size() + 1;
        msg.sender = sender;
        msg.content = content;

        auto now = std::chrono::system_clock::now();
        auto time = std::chrono::system_clock::to_time_t(now);
        std::stringstream ss;
        ss << std::put_time(std::localtime(&time), "%Y-%m-%d %H:%M:%S");
        msg.timestamp = ss.str();

        messages.push_back(msg);
        saveToFile();
    }

    std::string getConversationJson()
    {
        std::lock_guard<std::mutex> lock(mtx);

        JsonWriter jw;
        jw.startObject();
        jw.addKeyValue("total_messages", (int)messages.size());

        jw.addKeyValue("messages", "");
        jw.startArray();
        bool first = true;
        for (const auto &msg : messages)
        {
            if (!first)
                jw.addKeyValue("", ",");
            jw.addKeyValue("", msg.toJson());
            first = false;
        }
        jw.endArray();

        jw.endObject();
        return jw.toString();
    }

private:
    void loadFromFile()
    {
        std::ifstream file(filename);
        if (file.is_open())
        {
            std::string line;
            while (std::getline(file, line))
            {
                if (line.find("content") != std::string::npos)
                {
                }
            }
            file.close();
        }
    }

    void saveToFile()
    {
        std::ofstream file(filename);
        if (file.is_open())
        {
            file << getConversationJson();
            file.close();
        }
    }
};

class TCPServer
{
private:
    int server_fd;
    std::atomic<bool> running{false};
    ConversationManager &convManager;

public:
    TCPServer(ConversationManager &manager, int port = 8081) : convManager(manager)
    {
#ifdef _WIN32
        WSADATA wsaData;
        if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0)
        {
            std::cerr << "WSAStartup failed" << std::endl;
            return;
        }
#endif

        server_fd = socket(AF_INET, SOCK_STREAM, 0);
        if (server_fd < 0)
        {
            std::cerr << "Socket creation failed" << std::endl;
            return;
        }

        int opt = 1;
#ifdef _WIN32
        setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, (char *)&opt, sizeof(opt));
#else
        setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

        struct sockaddr_in address;
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = INADDR_ANY;
        address.sin_port = htons(port);

        if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0)
        {
            std::cerr << "Bind failed" << std::endl;
            return;
        }

        if (listen(server_fd, 3) < 0)
        {
            std::cerr << "Listen failed" << std::endl;
            return;
        }

        running = true;
        std::cout << "C++ TCP Server started on port " << port << std::endl;
    }

    void run()
    {
        while (running)
        {
            struct sockaddr_in client_addr;
#ifdef _WIN32
            int addrlen = sizeof(client_addr);
#else
            socklen_t addrlen = sizeof(client_addr);
#endif

            int client_fd = accept(server_fd, (struct sockaddr *)&client_addr, &addrlen);
            if (client_fd < 0)
            {
                std::cerr << "Accept failed" << std::endl;
                continue;
            }

            std::thread(&TCPServer::handleClient, this, client_fd).detach();
        }
    }

    void stop()
    {
        running = false;
#ifdef _WIN32
        closesocket(server_fd);
        WSACleanup();
#else
        close(server_fd);
#endif
    }

private:
    void handleClient(int client_fd)
    {
        char buffer[1024] = {0};
        int bytes_read = recv(client_fd, buffer, sizeof(buffer), 0);

        if (bytes_read > 0)
        {
            std::string request(buffer);

            if (request.find("GET /conversation") != std::string::npos)
            {
                std::string response = "HTTP/1.1 200 OK\r\n"
                                       "Content-Type: application/json\r\n"
                                       "Access-Control-Allow-Origin: *\r\n"
                                       "\r\n" +
                                       convManager.getConversationJson();

                send(client_fd, response.c_str(), response.length(), 0);
            }
            else if (request.find("POST /message") != std::string::npos)
            {
                size_t pos = request.find("\r\n\r\n");
                if (pos != std::string::npos)
                {
                    std::string body = request.substr(pos + 4);
                    convManager.addMessage("user", body.substr(0, 100));

                    std::string response = "HTTP/1.1 200 OK\r\n"
                                           "Content-Type: application/json\r\n"
                                           "\r\n"
                                           "{\"status\":\"success\"}";

                    send(client_fd, response.c_str(), response.length(), 0);
                }
            }
        }

#ifdef _WIN32
        closesocket(client_fd);
#else
        close(client_fd);
#endif
    }
};

class VoiceAssistant
{
private:
    ConversationManager convManager;
    TCPServer server;
    std::atomic<bool> running{false};

public:
    VoiceAssistant() : convManager("communication_cpp.json"), server(convManager, 8081) {}

    void start()
    {
        std::cout << "Starting C++ Voice Assistant..." << std::endl;

        convManager.addMessage("assistant", "C++ Voice Assistant started.");

        std::thread serverThread([this]()
                                 { server.run(); });

        running = true;

        while (running)
        {
            std::cout << "\nOptions:" << std::endl;
            std::cout << "1. Add message" << std::endl;
            std::cout << "2. View conversation" << std::endl;
            std::cout << "3. Save and exit" << std::endl;
            std::cout << "Choice: ";

            int choice;
            std::cin >> choice;
            std::cin.ignore();

            switch (choice)
            {
            case 1:
            {
                std::cout << "Enter message: ";
                std::string message;
                std::getline(std::cin, message);
                convManager.addMessage("user", message);

                std::string response = "Echo: " + message;
                convManager.addMessage("assistant", response);
                std::cout << "Assistant: " << response << std::endl;
                break;
            }
            case 2:
                std::cout << convManager.getConversationJson() << std::endl;
                break;
            case 3:
                running = false;
                break;
            default:
                std::cout << "Invalid choice" << std::endl;
            }
        }

        server.stop();
        if (serverThread.joinable())
        {
            serverThread.join();
        }

        std::cout << "Assistant stopped." << std::endl;
    }
};

int main()
{
    std::cout << "|==========================================================|" << std::endl;
    std::cout << "|                    C++ Voice Assistant                   |" << std::endl;
    std::cout << "|==========================================================|" << std::endl;

    VoiceAssistant assistant;
    assistant.start();

    return 0;
}