import os
import psycopg
from psycopg import sql

with psycopg.connect(dbname='postgres', user=os.environ['POSTGRES_USER'],
                     password=os.environ['POSTGRES_PASSWORD'],
                     host=os.environ['POSTGRES_HOST'], port=os.environ['POSTGRES_PORT'],
                     autocommit=True) as connection:
    name = os.environ['POSTGRES_DB']
    if not connection.execute('SELECT 1 FROM pg_database WHERE datname=%s', [name]).fetchone():
        connection.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
        print('Created project database.')
    else:
        print('Project database already exists.')
