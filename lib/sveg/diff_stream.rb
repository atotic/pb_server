# diff_stream.rb
module PB

require_relative 'comet_client'

class BookOutOfDateError < StandardError
	attr_accessor :request_diff_id, :book_diff_id
	def initialize(request_diff_id, book_diff_id)
		super "Book out of date"
		@request_diff_id = request_diff_id
		@book_diff_id = book_diff_id
	end
end
class BookDiffStream < Sequel::Model(:book_diff_stream)
	plugin :timestamps
	many_to_one :book

	def self.apply_diff(json_diff, last_diff_id, book_id)
		last_diff_id = last_diff_id.to_i
		DB.transaction do
			book_id = book_id.to_i

			# lock the book for updates
			DB[:books].select(:id).filter(:id => book_id).for_update
			# patch the book
			book = PB::Book[book_id]
			raise BookOutOfDateError.new(last_diff_id, book.last_diff) unless last_diff_id == book.last_diff

			# create new diff
			diff =BookDiffStream.create( {
				:type => 'Patch',
				:book_id => book_id,
				:payload => json_diff.to_json
				})

			# apply diff
			old_document = JSON.parse(book.document)
			book[:document] = JsonDiff.patch(old_document, json_diff).to_json
			book[:last_diff] = diff.pk
			book.save_changes

			PB::CometClient.broadcast_catch_up(book.pk)
			diff
		end
	end

	def self.generate_diff_stream(book_id, after_id, upto_id)
		diffs = []
		commands = PB::BookDiffStream.filter({:book_id => book_id}).filter('id > ?', after_id).filter('id <= ?', upto_id).order(:id)
		commands.each do |cmd|
			x = {
				:id => cmd.pk,
				:type => cmd[:type],
				:book_id => cmd[:book_id],
				:payload => JSON.parse(cmd[:payload])
			}
			diffs.push x
		end
		return diffs.to_json
	end

	def self.broadcast_catch_up(book_id)
		url = "http://#{SvegSettings.comet_host}:#{SvegSettings.comet_port}/catch_up/#{book_id}"
		http = EventMachine::HttpRequest.new(url).get
		http.errback {
			PB.logger.error "Comet broadcast fail errback #{http.response_header.status}, #{http.response}"
		}
		http.callback {
			PB.logger.error "Comet broadcast fail #{http.response_header.status}, #{http.response}" unless http.response_header.status == 200
		}
	end

end

end
