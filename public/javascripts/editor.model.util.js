
PB.Model = {};
PB.Model.Util = {
	addLocalPhotoToBook: function(book, file) {  // file is a js File object
		var photos  = book.photos();
		for (var i=0; i< photos.length; i++)
			if (photos[i].name() == file.name) 
			{
				PB.warn("Photo with the name " + file.name + " is already in the book.");
				return;
			};
		var photo = new PB.PhotoBroker(file);
		book.addPhoto(photo);
		// Save on server
		photo.saveOnServer(book.id);
	}
}
