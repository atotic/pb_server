CREATE USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PW';
DROP DATABASE IF EXISTS sveg_development;
CREATE DATABASE sveg_development;
GRANT ALL PRIVILEGES ON DATABASE sveg_development TO $POSTGRES_USER;
DROP DATABASE IF EXISTS sveg_test;
CREATE DATABASE sveg_test;
GRANT ALL PRIVILEGES ON DATABASE sveg_test TO $POSTGRES_USER;
DROP DATABASE IF EXISTS sveg_production;
CREATE DATABASE sveg_production;
GRANT ALL PRIVILEGES ON sveg_production TO $POSTGRES_USER;
FLUSH PRIVILEGES;
