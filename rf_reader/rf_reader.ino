// -------------------- Increase MQTT buffer --------------------
#define MQTT_MAX_PACKET_SIZE 1024
#define MQTT_SOCKET_TIMEOUT 5

#include <WiFi.h>
#include <SPI.h>
#include <PubSubClient.h>
#include <MFRC522v2.h>
#include <MFRC522DriverSPI.h>
#include <MFRC522DriverPinSimple.h>

// -------------------- WiFi --------------------
const char* ssid = "####";
const char* password = "####";

// -------------------- MQTT --------------------
const char* mqtt_server = "10.147.242.47"; // Laptop IP (MQTT broker)
const int mqtt_port = 1883;  // CRITICAL: Must be 1883 for MQTT, NOT 5000

// Reader identity
const char* reader_code = "RR-ENT-ER-01";

// -------------------- RFID --------------------
#define SS_PIN 5
#define RST_PIN 22

MFRC522DriverPinSimple ss_pin(SS_PIN);
MFRC522DriverSPI driver{ss_pin};
MFRC522 rfid{driver};

// -------------------- MQTT Client --------------------
WiFiClient espClient;
PubSubClient client(espClient);

// -------------------- Debug Functions --------------------
void printMQTTState() {
  int state = client.state();
  Serial.print("MQTT State: ");
  switch(state) {
    case -4: Serial.println("CONNECTION_TIMEOUT"); break;
    case -3: Serial.println("CONNECTION_LOST"); break;
    case -2: Serial.println("CONNECT_FAILED"); break;
    case -1: Serial.println("DISCONNECTED"); break;
    case 0: Serial.println("CONNECTED"); break;
    case 1: Serial.println("BAD_PROTOCOL"); break;
    case 2: Serial.println("BAD_CLIENT_ID"); break;
    case 3: Serial.println("UNAVAILABLE"); break;
    case 4: Serial.println("BAD_CREDENTIALS"); break;
    case 5: Serial.println("UNAUTHORIZED"); break;
    default: Serial.println("UNKNOWN"); break;
  }
}

// -------------------- Connect to MQTT --------------------
bool connectMQTT() {
  // Disconnect first
  if (client.connected()) {
    client.disconnect();
  }
  
  // Make sure WiFi is still connected
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected! Reconnecting...");
    WiFi.begin(ssid, password);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("\nWiFi reconnection failed!");
      return false;
    }
    Serial.println("\nWiFi reconnected!");
  }
  
  Serial.print("Connecting to MQTT...");
  
  // Generate unique client ID
  String clientId = "ESP32_" + WiFi.macAddress();
  clientId.replace(":", "");
  
  // Try to connect
  bool connected = client.connect(clientId.c_str());
  
  if (connected) {
    Serial.println(" ✓ Connected!");
    return true;
  } else {
    Serial.print(" ✗ Failed! ");
    printMQTTState();
    return false;
  }
}

// -------------------- Simple Publish --------------------
bool simplePublish(const char* topic, const char* payload) {
  Serial.println("\n=== PUBLISHING ===");
  Serial.print("Topic: ");
  Serial.println(topic);
  Serial.print("Payload: ");
  Serial.println(payload);
  Serial.print("Length: ");
  Serial.println(strlen(payload));
  
  // Ensure we're connected
  if (!client.connected()) {
    Serial.println("Not connected, connecting...");
    if (!connectMQTT()) {
      Serial.println("Connection failed!");
      return false;
    }
  }
  
  // Process any pending messages
  client.loop();
  yield();
  
  // Publish
  Serial.print("Publishing... ");
  bool result = client.publish(topic, payload);
  
  if (result) {
    Serial.println("✓ SUCCESS!");
    client.loop();
    return true;
  } else {
    Serial.println("✗ FAILED!");
    Serial.print("Client state: ");
    Serial.println(client.state());
    Serial.print("WiFi connected: ");
    Serial.println(WiFi.status() == WL_CONNECTED ? "YES" : "NO");
    Serial.print("TCP connected: ");
    Serial.println(espClient.connected() ? "YES" : "NO");
    return false;
  }
}

// -------------------- Publish with retry --------------------
bool publishWithRetry(const char* topic, const char* payload, int maxRetries = 3) {
  for (int i = 0; i < maxRetries; i++) {
    if (i > 0) {
      Serial.print("\nRetry ");
      Serial.print(i + 1);
      Serial.print("/");
      Serial.println(maxRetries);
      
      // Force fresh connection
      client.disconnect();
      espClient.stop();
      delay(500);
      
      if (!connectMQTT()) {
        delay(1000);
        continue;
      }
      delay(200);
    }
    
    if (simplePublish(topic, payload)) {
      Serial.println("==================\n");
      return true;
    }
    
    delay(1000);
  }
  
  Serial.println("❌ All retries failed!");
  Serial.println("==================\n");
  return false;
}

// -------------------- Setup --------------------
void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("ESP32 RFID MQTT Reader Starting");
  
  // Connect WiFi
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int wifi_attempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifi_attempts < 30) {
    delay(500);
    Serial.print(".");
    wifi_attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("MAC Address: ");
    Serial.println(WiFi.macAddress());
  } else {
    Serial.println("\n✗ WiFi connection failed!");
    Serial.println("Restarting...");
    delay(3000);
    ESP.restart();
  }
  
  // Initialize MQTT
  Serial.print("\nMQTT Broker: ");
  Serial.print(mqtt_server);
  Serial.print(":");
  Serial.println(mqtt_port);
  Serial.println("⚠️  IMPORTANT: Connecting to port 1883 (MQTT), NOT port 5000 (Flask)");
  
  client.setServer(mqtt_server, mqtt_port);
  
  // Connect to MQTT
  if (!connectMQTT()) {
    Serial.println("Initial MQTT connection failed, but continuing...");
  }
  delay(500);
  
  // Initialize SPI and RFID
  Serial.println("\nInitializing RFID Reader...");
  SPI.begin(18, 19, 23, SS_PIN);
  rfid.PCD_Init();
  
  Serial.println("✓ RFID Reader Ready!");
  
  // Send boot event
  Serial.println("\n>>> Sending boot event...");
  String bootPayload = "{";
  bootPayload += "\"event_type\":\"boot\",";
  bootPayload += "\"reader\":\"" + String(reader_code) + "\",";
  bootPayload += "\"mac\":\"" + WiFi.macAddress() + "\"";
  bootPayload += "}";
  
  publishWithRetry("asset_tracking/readers/ROOM101_READER/scan", bootPayload.c_str());
  
  Serial.println("\n=================================");
  Serial.println("System Ready - Scan a card");
  Serial.println("=================================\n");
}

// -------------------- Loop --------------------
void loop() {
  // Maintain MQTT connection
  if (!client.connected()) {
    static unsigned long lastReconnect = 0;
    if (millis() - lastReconnect > 5000) {
      Serial.println("⚠ Reconnecting to MQTT...");
      connectMQTT();
      lastReconnect = millis();
    }
  } else {
    client.loop();
  }
  
  // Check for new RFID card
  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }
  
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  // Read UID
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      uid += "0";
    }
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  
  Serial.println("\n🔍 CARD DETECTED!");
  Serial.print("UID: ");
  Serial.println(uid);
  
  // Prepare payload
  String scanPayload = "{";
  scanPayload += "\"event_type\":\"scan\",";
  scanPayload += "\"uid\":\"" + uid + "\",";
  scanPayload += "\"reader\":\"" + String(reader_code) + "\"";
  scanPayload += "}";
  
  // Publish scan event
  bool success = publishWithRetry("asset_tracking/readers/ROOM101_READER/scan", scanPayload.c_str());
  
  if (success) {
    Serial.println("✓✓✓ Scan published successfully! ✓✓✓\n");
  } else {
    Serial.println("❌❌❌ Failed to publish scan! ❌❌❌\n");
  }
  
  rfid.PICC_HaltA();
  delay(2000); // Prevent duplicate reads
}
