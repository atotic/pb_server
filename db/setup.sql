GRANT USAGE ON *.* TO sveg@localhost IDENTIFIED BY 'svegsveg';
DROP DATABASE IF EXISTS sveg_development; CREATE DATABASE sveg_development; GRANT ALL PRIVILEGES ON sveg_development.* TO sveg;
DROP DATABASE IF EXISTS sveg_test; CREATE DATABASE sveg_test; GRANT ALL PRIVILEGES ON sveg_test.* TO sveg;
DROP DATABASE IF EXISTS sveg_production; CREATE DATABASE sveg_production; GRANT ALL PRIVILEGES ON sveg_production.* TO sveg;
FLUSH PRIVILEGES;
