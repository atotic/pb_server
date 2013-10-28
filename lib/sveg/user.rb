require 'sequel'
require 'active_support'
module PB

class User < Sequel::Model

 	plugin :timestamps

	one_to_many :books
	one_to_many :photos

	@@anonymous_user_id = -1

	def save_to_session(env, expire = :session)
		expire_in = (SvegSettings.development? ? 5 : 1) * 24 * 3600	# one day
		env['rack.session']['user_id'] = self.pk
		# our session has expiration baked in
		env['rack.session']['user_id_expires'] = ( Time.now + expire_in).to_i
		# cookie expires after browser session, or 'expire_in' time
		env['rack.session.options'][:expire_after] = expire == :session ? nil : expire_in;
		env['sveg.user'] = self
	end

	def self.restore_from_session(env)
		user_id = env['rack.session']['user_id'].to_i
		expire = env['rack.session']['user_id_expires']
		expire_time = Time.at(expire.to_i)
#		return self.anonymous_user unless expire_time > Time.now
		env['sveg.user'] = self[user_id] || self.anonymous_user
	end

	def login(env)
		save_to_session(env)
	end

	def self.logout(env)
		env['rack.session'].delete('user_id')
		env['rack.session'].delete('user_id_expires')
	end

	def to_s
		"#{self.display_name}:#{self.pk}"
	end

	def self.anonymous_user
		if @@anonymous_user_id == -1
			user = self[:email => 'anonymous@pook.io']
			unless user
				user = User.new( { :display_name => "Anonymous", :email => "anonymous@pook.io"})
				user.save
			end
			@@anonymous_user_id = user.pk
		end
		PB.logger.info "anonymous user"
		return self[@@anonymous_user_id]
	end

end

# Each Omniauth login generates a token
# OmniauthToken is a simple username/pw login in theory
# For now, it is just username.
class OmniauthToken < Sequel::Model(:omniauth_tokens)


	STRATEGY_CODES = {
		0 => :developer,
		1 => :facebook,
		2 => :'google_oauth2'
	}

	STRATEGY_NAMES = {
		:developer => 0,
		:facebook => 1,
		:'google_oauth2' => 2
	}

	def self.get_strategy_id(strategy)
		strategy_id = STRATEGY_NAMES[strategy.to_sym]
		raise "unknown strategy #{strategy.to_s}" unless !strategy_id.nil?
		strategy_id
	end

	# returns [user, is_new?]
	# throws string exceptions
	def self.login_with_omniauth(omniauth)
		strategy_id = get_strategy_id(omniauth['provider'])
		auth = self.filter(:strategy => strategy_id, :strategy_uid => omniauth['uid']).first
		if auth.nil?
			name = omniauth['info']['name'] || "Unknown"
			email = (omniauth['info']['email'] || "").downcase
			DB.transaction do
				# logins with same email from different providers point to same user
				user = User[:email => email] || User.new( { :display_name => name, :email => email})
				user.is_administrator = true if email.eql? "a@totic.org"
				user.save
				auth = OmniauthToken.new( {
					:user_id => user.pk,
					:strategy => strategy_id,
					:strategy_uid => omniauth['uid'],
					:auth_data => omniauth.to_json
					})
				auth.save
				[user, true]
			end
		else
			DB.transaction do
				auth.auth_data = omniauth.to_json
				auth.save
				[auth.user, false]
			end
		end
	end

	# returns an array of strategies
	def self.get_tokens(user)
		self.filter(:user_id => user.pk).all.map { |token| STRATEGY_CODES[token.strategy].to_s }
	end

	def self.login_as_printer
		user = PB::User.where(:email => 'printerqueue@pook.io').first
		unless user
			DB.transaction do
				user = User.new( { :display_name => 'Pookio Printer', :email => 'printerqueue@pook.io'})
				user.is_administrator = true
				user.save
			end
		end
		user
	end

	plugin :timestamps

	many_to_one :user # user this authorization is for

end

end
