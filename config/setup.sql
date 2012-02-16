CREATE DATABASE sveg_development;
CREATE DATABASE sveg_test;
CREATE DATABASE sveg_production;
GRANT USAGE ON *.* TO sveg@localhost IDENTIFIED BY 'svegsveg';
GRANT ALL PRIVILEGES ON sveg_development.* TO sveg;
GRANT ALL PRIVILEGES ON sveg_test.* TO sveg;
GRANT ALL PRIVILEGES ON sveg_production.* TO sveg;
FLUSH PRIVILEGES;
