# comet_client.rb
require 'uri'
require 'net/http'
module PB

class CometClient
	def self.broadcast_catch_up(book_id)
		url = URI::HTTP.build({
			:host => SvegSettings.comet_host,
			:port => SvegSettings.comet_port,
			:path => "/catch_up/#{book_id}"
			});
		Thread.new do
			response = Net::HTTP.get_response(url)
			if response.code != 200
				PB.logger.error "Comet broadcast_catch_up fail errback #{http.response_header.status}, #{http.response}"
			end
		end
		# http = EventMachine::HttpRequest.new(url).get
		# http.errback {
		# 	PB.logger.error "Comet broadcast_catch_up fail errback #{http.response_header.status}, #{http.response}"
		# }
		# http.callback {
		# 	PB.logger.error "Comet broadcast_catch_up fail #{http.response_header.status}, #{http.response}" unless http.response_header.status == 200
		# }
	end

	def self.broadcast_text_message(book_id, message, severity=nil)
		severity ||= 'info'
		url = URI::HTTP.build({
			:host => SvegSettings.comet_host,
			:port => SvegSettings.comet_port,
			:path => "/text_message/#{book_id}",
			:query => URI.encode_www_form( { :message => message, :severity => severity })
			})
		Thread.new do
			response = Net::HTTP.get_response(url)
			if response.code != 200
				PB.logger.error "Comet broadcast_catch_up fail errback #{http.response_header.status}, #{http.response}"
			end
		end

		# http = EventMachine::HttpRequest.new(url).get
		# http.errback {
		# 	PB.logger.error "Comet broadcast_text_message fail errback #{http.response_header.status}, #{http.response}"
		# }
		# http.callback {
		# 	PB.logger.error "Comet broadcast_text_message fail #{http.response_header.status}, #{http.response}" unless http.response_header.status == 200
		# }
	end
end

end
