#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <pthread.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <stdatomic.h>

#define MAX_MESSAGES 100
#define MAX_MESSAGE_LENGTH 500
#define PORT 8082
#define BUFFER_SIZE 1024

typedef struct {
    int id;
    char sender[50];
    char content[MAX_MESSAGE_LENGTH];
    char timestamp[20];
} Message;

typedef struct {
    Message messages[MAX_MESSAGES];
    int count;
    pthread_mutex_t mutex;
    char filename[100];
} ConversationManager;

void get_current_timestamp(char* buffer, size_t size) {
    time_t rawtime;
    struct tm* timeinfo;
    
    time(&rawtime);
    timeinfo = localtime(&rawtime);
    
    strftime(buffer, size, "%Y-%m-%d %H:%M:%S", timeinfo);
}

void conversation_manager_init(ConversationManager* cm, const char* filename) {
    cm->count = 0;
    strncpy(cm->filename, filename, sizeof(cm->filename) - 1);
    pthread_mutex_init(&cm->mutex, NULL);
    
    Message initial_msg;
    initial_msg.id = 1;
    strcpy(initial_msg.sender, "assistant");
    strcpy(initial_msg.content, "C Voice Assistant initialized.");
    get_current_timestamp(initial_msg.timestamp, sizeof(initial_msg.timestamp));
    
    cm->messages[cm->count++] = initial_msg;
}

void conversation_manager_add(ConversationManager* cm, const char* sender, const char* content) {
    pthread_mutex_lock(&cm->mutex);
    
    if (cm->count < MAX_MESSAGES) {
        Message msg;
        msg.id = cm->count + 1;
        strncpy(msg.sender, sender, sizeof(msg.sender) - 1);
        strncpy(msg.content, content, sizeof(msg.content) - 1);
        get_current_timestamp(msg.timestamp, sizeof(msg.timestamp));
        
        cm->messages[cm->count++] = msg;
        
        FILE* file = fopen(cm->filename, "a");
        if (file) {
            fprintf(file, "[%s] %s: %s\n", msg.timestamp, msg.sender, msg.content);
            fclose(file);
        }
    }
    
    pthread_mutex_unlock(&cm->mutex);
}

char* conversation_manager_to_json(ConversationManager* cm) {
    static char json[5000];
    strcpy(json, "{\"messages\":[");
    
    pthread_mutex_lock(&cm->mutex);
    
    for (int i = 0; i < cm->count; i++) {
        char message_json[1000];
        snprintf(message_json, sizeof(message_json),
                "{\"id\":%d,\"sender\":\"%s\",\"content\":\"%s\",\"timestamp\":\"%s\"}",
                cm->messages[i].id,
                cm->messages[i].sender,
                cm->messages[i].content,
                cm->messages[i].timestamp);
        
        strcat(json, message_json);
        
        if (i < cm->count - 1) {
            strcat(json, ",");
        }
    }
    
    pthread_mutex_unlock(&cm->mutex);
    
    strcat(json, "],\"count\":");
    
    char count_str[10];
    sprintf(count_str, "%d", cm->count);
    strcat(json, count_str);
    strcat(json, "}");
    
    return json;
}

void* handle_client(void* arg) {
    int client_fd = *(int*)arg;
    free(arg);
    
    char buffer[BUFFER_SIZE] = {0};
    read(client_fd, buffer, sizeof(buffer));
    
    ConversationManager* cm = (ConversationManager*)arg;
    
    if (strstr(buffer, "GET /conversation")) {
        char* json = conversation_manager_to_json(cm);
        char response[6000];
        
        snprintf(response, sizeof(response),
                "HTTP/1.1 200 OK\r\n"
                "Content-Type: application/json\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "\r\n"
                "%s", json);
        
        write(client_fd, response, strlen(response));
    }
    else if (strstr(buffer, "POST /message")) {
        conversation_manager_add(cm, "user", "Message from C client");
        
        const char* response = 
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: application/json\r\n"
            "\r\n"
            "{\"status\":\"success\"}";
        
        write(client_fd, response, strlen(response));
    }
    
    close(client_fd);
    return NULL;
}

void* server_thread(void* arg) {
    ConversationManager* cm = (ConversationManager*)arg;
    
    int server_fd;
    struct sockaddr_in address;
    int addrlen = sizeof(address);
    
    server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd == 0) {
        perror("socket failed");
        return NULL;
    }
    
    int opt = 1;
    if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt))) {
        perror("setsockopt");
        return NULL;
    }
    
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(PORT);
    
    if (bind(server_fd, (struct sockaddr*)&address, sizeof(address)) < 0) {
        perror("bind failed");
        return NULL;
    }
    
    if (listen(server_fd, 3) < 0) {
        perror("listen");
        return NULL;
    }
    
    printf("C Server listening on port %d\n", PORT);
    
    while (1) {
        int* client_fd = malloc(sizeof(int));
        *client_fd = accept(server_fd, (struct sockaddr*)&address, (socklen_t*)&addrlen);
        
        if (*client_fd < 0) {
            free(client_fd);
            continue;
        }
        
        pthread_t thread;
        pthread_create(&thread, NULL, handle_client, client_fd);
        pthread_detach(thread);
    }
    
    return NULL;
}

void print_banner() {
    printf("\n");
    printf("╔══════════════════════════════════════════════════════════╗\n");
    printf("║              C Voice Assistant                           ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n");
    printf("\n");
}

void interactive_mode(ConversationManager* cm) {
    char input[MAX_MESSAGE_LENGTH];
    
    while (1) {
        printf("\nOptions:\n");
        printf("1. Send message\n");
        printf("2. View conversation\n");
        printf("3. Exit\n");
        printf("Choice: ");
        
        int choice;
        scanf("%d", &choice);
        getchar(); // Consume newline
        
        switch (choice) {
            case 1:
                printf("Enter message: ");
                fgets(input, sizeof(input), stdin);
                input[strcspn(input, "\n")] = 0; // Remove newline
                
                conversation_manager_add(cm, "user", input);
                
                char response[MAX_MESSAGE_LENGTH + 10];
                snprintf(response, sizeof(response), "Echo: %s", input);
                conversation_manager_add(cm, "assistant", response);
                
                printf("Assistant: %s\n", response);
                break;
                
            case 2:
                printf("\nConversation:\n%s\n", conversation_manager_to_json(cm));
                break;
                
            case 3:
                printf("Exiting...\n");
                return;
                
            default:
                printf("Invalid choice\n");
        }
    }
}

int main() {
    print_banner();
    
    ConversationManager cm;
    conversation_manager_init(&cm, "communication_c.json");
    
    pthread_t server_thread_id;
    pthread_create(&server_thread_id, NULL, server_thread, &cm);
    
    interactive_mode(&cm);
    
    printf("C Voice Assistant terminated.\n");
    return 0;
}