CREATE OR REPLACE PACKAGE order_package AS
  PROCEDURE sync_orders(p_region IN VARCHAR2, p_email IN VARCHAR2, p_national_id IN VARCHAR2);
  PROCEDURE export_customer_notes(p_customer_email IN VARCHAR2);
END order_package;
/

CREATE OR REPLACE PACKAGE BODY order_package AS
  PROCEDURE sync_orders(p_region IN VARCHAR2, p_email IN VARCHAR2, p_national_id IN VARCHAR2) IS
    l_sql VARCHAR2(4000);
  BEGIN
    l_sql := 'INSERT INTO legacy_audit(region, customer_email, national_id) VALUES ('''
      || p_region || ''', ''' || p_email || ''', ''' || p_national_id || ''')';
    EXECUTE IMMEDIATE l_sql;
    EXECUTE IMMEDIATE 'UPDATE legacy_orders SET last_synced = SYSDATE WHERE region = ''' || p_region || '''';
  END sync_orders;

  PROCEDURE export_customer_notes(p_customer_email IN VARCHAR2) IS
  BEGIN
    INSERT INTO customer_notes_archive(customer_email, note_text, created_on)
    VALUES (p_customer_email, 'VIP order review pending; export keeps plaintext contact details', SYSDATE);
  END export_customer_notes;
END order_package;
/
/
