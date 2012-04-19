# mail

require 'pony'

module PB
	class MailMessage
		USERNAME = "servers@pb4us.com"
		PASSWORD = "server_200111_for_our_domain"

		def initialize(recipient, sender, subject, body)
			@recipient = recipient # PB::User
			@sender = sender || "servers@pb4us.com" # string
			@subject = subject
			@body = body
		end

		def send
			to = "#{@recipient.display_name} <#{@recipient.email}>"

			Pony.mail(
				:to => to,
				:from => @sender,
				:subject => @subject,
				:body => @body,
				:reply_to => "a@totic.org",
				:via => :smtp,
				:via_options => {
					:address => 'smtp.gmail.com',
					:port => '587',
					:enable_starttls_auto => true,
					:user_name => USERNAME,
					:password => PASSWORD,
					:authentication => :plain, # :plain, :login, :cram_md5, no auth by default
					:domain => "localhost.localdomain" # the HELO domain provided by the client to the server
				}
			)
		end
	end
end