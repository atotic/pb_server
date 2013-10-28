# secret passwords and keys

module PB
	class Secrets
		POSTGRES_USER = ENV['POSTGRES_USER']
		POSTGRES_PW = ENV['POSTGRES_PW']
# https://developers.facebook.com/apps
		FB_APP_ID = ENV['FB_APP_ID']
		FB_SECRET = ENV['FB_SECRET']
# google API console https://code.google.com/apis/console/b/0/#project:852719091736:access
		GOOGLE_KEY = ENV['GOOGLE_KEY']
		GOOGLE_SECRET = ENV['GOOGLE_SECRET']
	end
	abort("ENVIRONMENT VARIABLES NOT DEFINED, see secrets.rb") unless Secrets::POSTGRES_PW && Secrets::POSTGRES_USER && Secrets::FB_APP_ID && Secrets::FB_SECRET && Secrets::GOOGLE_KEY && Secrets::GOOGLE_SECRET
end

