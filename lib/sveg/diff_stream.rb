# diff_stream.rb
require 'eventmachine'

module PB

class BookDiffStream < Sequel::Model(:book_diff_stream)
	plugin :timestamps
	many_to_one :book

	def self.apply_diff(json_diff, book_id)
		DB.transaction do
			book_id = book_id.to_i

			# create new diff
			diff =BookDiffStream.create( {
				:type => 'Patch',
				:book_id => book_id,
				:payload => json_diff.to_json
				})
			# lock the book for updates
			DB[:books].select(:id).filter(:id => 26).for_update
			# patch the book
			book = PB::Book[book_id]
			old_document = JSON.parse(book.document)
			book[:document] = JsonDiff.patch(old_document, json_diff).to_json
			book[:last_diff] = diff.pk
			book.save_changes
			self.broadcast_catch_up(book.pk)
			diff
		end
	end

	def self.broadcast_catch_up(book_id)
		http = EventMachine::Protocols::HttpClient.request(
		 :host => SvegSettings.comet_host,
		 :port => SvegSettings.comet_port,
		 :request => "/catch_up/#{book_id}"
		)
		http.callback {|response|
			PB.logger.error "Comet broadcast #{response[:status]}, #{response[:content]}" unless response[:status].eql? 200
		}
	end

end

end
