import redis

# Your specific connection details
HOST = 'redis-18031.c262.us-east-1-3.ec2.cloud.redislabs.com'
PORT = 18031
PASSWORD = 'QvSvBgW5HNdISqYeWYSsMTUTyVnXBolU'

def test_connection():
    try:
        # Connect to Redis Cloud
        r = redis.Redis(
            host=HOST,
            port=PORT,
            password=PASSWORD,
            decode_responses=True
        )
        
        # The 'ping' command checks if the server is alive
        if r.ping():
            print("✅ SUCCESS: PONG! Connected to Redis Cloud.")
            
            # Optional: Write a test key to be sure
            r.set('test_key', 'Hello from Python!')
            value = r.get('test_key')
            print(f"   Test Value retrieved: {value}")
            
    except redis.AuthenticationError:
        print("❌ ERROR: Authentication failed. Check password.")
    except Exception as e:
        print(f"❌ ERROR: Could not connect. Details: {e}")

if __name__ == '__main__':
    test_connection()
    