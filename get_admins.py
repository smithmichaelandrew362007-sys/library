from models import get_db

def main():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT member_id, username, name, contact, password FROM members WHERE role='admin'")
    admins = cur.fetchall()
    
    print("Admin Accounts:")
    print("-" * 50)
    for admin in admins:
        print(f"ID: {admin['member_id']}")
        print(f"Name: {admin['name']}")
        print(f"Username: {admin['username']}")
        print(f"Contact: {admin['contact']}")
        print(f"Password Hash/Plain: {admin['password']}")
        print("-" * 50)
        
    conn.close()

if __name__ == '__main__':
    main()
