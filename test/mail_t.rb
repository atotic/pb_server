# rake test:functional TEST=test/mail_t.rb

require 'test/unit'
require 'rack/test'
require_relative "helper"
require_relative '../config/settings'
require_relative '../config/db'
require_relative '../lib/sveg_lib'
require_relative '../lib/sveg/mail.rb'

# book model tests
class MailTest < Test::Unit::TestCase
	include TestHelpers
	
	def setup
	end

	def test_sending_mail
		u = create_user('atotic')
		u.email = "a@totic.org"
		msg = PB::MailMessage.new(u, nil, "Test", "this is a test message")
		msg.send
	end
	
end